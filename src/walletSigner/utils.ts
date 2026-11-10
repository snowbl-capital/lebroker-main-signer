import { isHex } from "viem"
import { isAddressBookMessage, verifiedAddressBookEntry } from "../lebroker/accounts/addressBookMessage/addressBookMessage"
import { SignaturePayloadKind, SignatureRequestKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { withApiScope } from "../lebroker/web/helpers/fetchApi/fetchApi"
import { depositAddressOf, lighterAccountsOf } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsMutationSign/utils"
import { POLYMARKET_PERPS_WITHDRAW_TYPE } from "../signableRequest/constants"
import type { ReadDepositAddress } from "../signableRequest/types"
import type { VerifiedEntry } from "../addressBookRecord/types"
import {
  DEPOSIT_ADDRESS_CACHE_MS,
  DEPOSIT_ADDRESS_PAUSE_MS,
  DEPOSIT_WITHDRAWAL_VENUES,
  LIGHTER_ACCOUNTS_CACHE_MS,
  LIGHTER_ACCOUNTS_PAUSE_MS,
  LIGHTER_READS,
} from "./constants"
import type {
  AsksAddressBookEntryProps,
  CreateDepositAddressReaderProps,
  CreateKeptReadsProps,
  CreateLighterAccountsReaderProps,
  DepositAddressReader,
  ErrorTextProps,
  KeptReads,
  LighterAccountsReader,
  Timers,
  VerifiedEntriesProps,
} from "./types"

/** An error's words for a log line: its message, never the object, which may carry what it was called with. */
function errorText({ error }: ErrorTextProps): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Reads kept a while once they answer, so passes every few seconds don't call a venue each time, and paused a while once
 * one fails (a read hides the venue's status, so a 429 or a 418 is among them): `key` names what's read, `pause` the
 * reads one failure stops. A failed or paused read gives nothing, which the allowlist refuses: nothing is signed. A read
 * that gives nothing isn't kept.
 */
function createKeptReads<T>({ now, keepMs, pauseMs }: CreateKeptReadsProps): KeptReads<T> {
  const answers = new Map<string, { value: T; at: number }>()
  const pausedUntil = new Map<string, number>()
  return async ({ key, pause, read }) => {
    const kept = answers.get(key)
    if (kept !== undefined && now() - kept.at < keepMs) {
      return kept.value
    }
    if (now() < (pausedUntil.get(pause) ?? Number.NEGATIVE_INFINITY)) {
      return undefined
    }
    try {
      const value = await read()
      for (const [old, answer] of answers) {
        if (now() - answer.at >= keepMs) {
          answers.delete(old)
        }
      }
      if (value !== undefined) {
        answers.set(key, { value, at: now() })
      }
      return value
    } catch {
      pausedUntil.set(pause, now() + pauseMs)
      return undefined
    }
  }
}

/**
 * One wallet's reads of its deposit address on a venue, for Main's withdrawal or LaMarge take paid straight into it
 * (lebroker's D49, D56): read by the signer itself, for the wallet's own address, just before it signs, as the web reads
 * it (`depositAddressOf`), never the request's word: Lighter's from Lighter; Bybit's the one Main signed, read under the
 * wallet's own session and taken only once Main's signature of it recovers here; through Polymarket's bridge, the
 * address the bridge answers this signer itself. Read only for a request whose rule reads it, a withdrawal from a venue
 * that pays one or a LaMarge move, so no other request makes this machine call a venue. Kept and paused per what it
 * reads: the venue paid into, whether through the bridge, and whether it's the Perps margin's step to its Deposit
 * Wallet, which reads nothing.
 */
function createDepositAddressReader({ address, client, now }: CreateDepositAddressReaderProps): DepositAddressReader {
  const reads = createKeptReads<ReadDepositAddress>({ now, keepMs: DEPOSIT_ADDRESS_CACHE_MS, pauseMs: DEPOSIT_ADDRESS_PAUSE_MS })
  return ({ request }) => {
    const payload = request.payload
    const read =
      request.kind === SignatureRequestKind.LAMARGE_MOVE ||
      (request.kind === SignatureRequestKind.WITHDRAWAL && request.venue !== null && DEPOSIT_WITHDRAWAL_VENUES.has(request.venue))
    if (payload.depositVenue === undefined || !read) {
      return Promise.resolve(undefined)
    }
    const toWallet = payload.kind === SignaturePayloadKind.TYPED_DATA && payload.typedData.primaryType === POLYMARKET_PERPS_WITHDRAW_TYPE
    const key = [payload.depositVenue, request.venue === VenueId.POLYMARKET_PERPS, toWallet].join(":")
    return reads({
      key,
      pause: key,
      read: () => withApiScope({ scope: { get: client.apiGet }, run: () => depositAddressOf({ request, address }) }),
    })
  }
}

/**
 * The reads of the Lighter accounts a Main's Lighter transfer names, by index, as the web reads them
 * (`lighterAccountsOf`): from Lighter itself, never lebroker. Kept per message, and paused all together once one fails.
 */
function createLighterAccountsReader({ now }: CreateLighterAccountsReaderProps): LighterAccountsReader {
  const reads = createKeptReads<ReadonlyMap<number, string>>({
    now,
    keepMs: LIGHTER_ACCOUNTS_CACHE_MS,
    pauseMs: LIGHTER_ACCOUNTS_PAUSE_MS,
  })
  return ({ request }) => {
    const payload = request.payload
    const key = payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE ? payload.message : ""
    return reads({ key, pause: LIGHTER_READS, read: () => lighterAccountsOf({ request }) })
  }
}

/**
 * The entries of the service's list this wallet's own key signed (lebroker's D70), each checked here: an entry counts
 * only when its message names this wallet's own address as Main and this deployment, and its signature recovers to
 * that address. What it says is read from the message as signed, never from the service's own fields.
 */
async function verifiedEntries({ entries, main, deployment }: VerifiedEntriesProps): Promise<VerifiedEntry[]> {
  const verified = await Promise.all(
    entries.map(async entry => {
      const signature = entry.signature
      if (!isHex(signature)) {
        return null
      }
      const content = await verifiedAddressBookEntry({ main, deployment, message: entry.message, signature })
      return content === null ? null : { message: entry.message, signature, content }
    }),
  )
  return verified.filter(entry => entry !== null)
}

/** Whether a request asks Main to sign an address-book entry, or a text that carries one: only the user does, in their wallet. */
function asksAddressBookEntry({ request }: AsksAddressBookEntryProps): boolean {
  return request.payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE && isAddressBookMessage({ message: request.payload.message })
}

const runtimeTimers: Timers = {
  every: ({ ms, run }) => {
    const interval = setInterval(run, ms)
    return () => clearInterval(interval)
  },
  sleep: ({ ms, signal }) =>
    new Promise(resolve => {
      if (signal.aborted) {
        resolve()
        return
      }
      const timeout = setTimeout(done, ms)
      function done() {
        clearTimeout(timeout)
        signal.removeEventListener("abort", done)
        resolve()
      }
      signal.addEventListener("abort", done)
    }),
}

export {
  asksAddressBookEntry,
  createDepositAddressReader,
  createKeptReads,
  createLighterAccountsReader,
  errorText,
  runtimeTimers,
  verifiedEntries,
}
