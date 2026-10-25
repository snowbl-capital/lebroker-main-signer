import { isHex } from "viem"
import { isAddressBookMessage, verifiedAddressBookEntry } from "../lebroker/accounts/addressBookMessage/addressBookMessage"
import { SignatureRequestKind, SignaturePayloadKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { WITHDRAWAL_DEPOSIT_MIN_USD } from "../lebroker/signer/model"
import { venueDepositAddress } from "../lebroker/web/helpers/venueDepositAddress/venueDepositAddress"
import { DEPOSIT_ADDRESS_CACHE_MS, DEPOSIT_ADDRESS_PAUSE_MS, HYPERLIQUID_WITHDRAW_PRIMARY_TYPE } from "./constants"
import type {
  ApprovedRecipientsProps,
  AsksAddressBookEntryProps,
  CreateDepositAddressReaderProps,
  DepositAddressReader,
  DepositVenueOfProps,
  ErrorTextProps,
  Timers,
} from "./types"

/** An error's words for a log line: its message, never the object, which may carry what it was called with. */
function errorText({ error }: ErrorTextProps): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The venue whose deposit address a request needs read: only Hyperliquid's `withdraw3` withdrawal naming a venue the
 * signer's least lists (Lighter). Any other request, whatever it names, reads nothing, so a request can't make this
 * machine call a venue.
 */
function depositVenueOf(props: DepositVenueOfProps): VenueId | undefined {
  const payload = props.request.payload
  if (
    props.request.kind !== SignatureRequestKind.WITHDRAWAL ||
    props.request.venue !== VenueId.HYPERLIQUID ||
    payload.kind !== SignaturePayloadKind.TYPED_DATA ||
    payload.typedData.primaryType !== HYPERLIQUID_WITHDRAW_PRIMARY_TYPE ||
    payload.depositVenue === undefined ||
    WITHDRAWAL_DEPOSIT_MIN_USD[payload.depositVenue] === undefined
  ) {
    return undefined
  }
  return payload.depositVenue
}

/**
 * One wallet's reads of its deposit address on a venue, for Main's withdrawal straight into it (lebroker's D49, D56):
 * read by the signer itself from the venue, for the wallet's own address, just before it signs, never the request's
 * word. An answer is kept a short while, so passes don't call the venue each time; a read that fails pauses the reads
 * for a while (the read hides the venue's status, so a 429 or a 418 is among them). A failed or paused read gives no
 * address, and the allowlist refuses the withdrawal: nothing is signed.
 */
function createDepositAddressReader(props: CreateDepositAddressReaderProps): DepositAddressReader {
  const answers = new Map<VenueId, { address: string; at: number }>()
  const pausedUntil = new Map<VenueId, number>()
  return async read => {
    const venue = depositVenueOf({ request: read.request })
    if (venue === undefined) {
      return undefined
    }
    const kept = answers.get(venue)
    if (kept !== undefined && props.now() - kept.at < DEPOSIT_ADDRESS_CACHE_MS) {
      return { venue, address: kept.address }
    }
    if (props.now() < (pausedUntil.get(venue) ?? Number.NEGATIVE_INFINITY)) {
      return undefined
    }
    try {
      const address = await venueDepositAddress({ venue, address: props.address })
      answers.set(venue, { address, at: props.now() })
      return { venue, address }
    } catch {
      pausedUntil.set(venue, props.now() + DEPOSIT_ADDRESS_PAUSE_MS)
      return undefined
    }
  }
}

/**
 * The recipients this wallet's own key approved in its address book (lebroker's D70), from the entries the service
 * lists, each checked here: an entry counts only when its message names this wallet's own address as Main and its
 * signature recovers to that address. Its recipients are read from the message as signed, never from the service's
 * own list of them.
 */
async function approvedRecipients({ entries, main }: ApprovedRecipientsProps): Promise<string[]> {
  const verified = await Promise.all(
    entries.map(entry =>
      isHex(entry.signature) ? verifiedAddressBookEntry({ main, message: entry.message, signature: entry.signature }) : null,
    ),
  )
  return verified.flatMap(content => (content === null ? [] : content.recipients.map(recipient => recipient.address)))
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

export { approvedRecipients, asksAddressBookEntry, createDepositAddressReader, errorText, runtimeTimers }
