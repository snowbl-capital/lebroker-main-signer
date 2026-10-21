import { ApiError } from "../api/errors"
import { readEvents } from "../eventStream/eventStream"
import { LogEvent, StreamStage } from "../log/enums"
import { SignatureRequestState } from "../lebroker/accounts/model"
import { signableRequest } from "../signableRequest/signableRequest"
import { signPayload } from "../signPayload/signPayload"
import {
  MAX_DECLINE_REASON,
  MAX_SEND_ATTEMPTS,
  POLL_MS,
  SAFETY_POLL_MS,
  SERVER_ERROR_STATUS,
  SIGNATURE_REQUESTS_EVENT,
  STREAM_RETRY_FIRST_MS,
  STREAM_RETRY_MAX_MS,
} from "./constants"
import { FailedStep, ReadSubject } from "./enums"
import type { CreateWalletSignerProps, DeclineProps, HandleProps, WalletSigner } from "./types"
import { errorText, runtimeTimers } from "./utils"

/**
 * Signs one Main wallet's signature requests as they wait (D2, D37), and only those lebroker's allowlist accepts (D43):
 * the very rules the web app runs before its wallet opens, against the user's accounts read again from the service. A
 * request the allowlist refuses is never signed: it's logged once, told to lebroker, and left for the user, in the
 * browser. Deferred requests (Later) are the user's choice and wait too.
 */
function createWalletSigner({
  wallet,
  client,
  chainId,
  appOrigin,
  log,
  timers = runtimeTimers,
  now = Date.now,
}: CreateWalletSignerProps): WalletSigner {
  const stopping = new AbortController()
  // Requests this signer is done with: signed, or failed for good. Neither is looked at again.
  const done = new Set<string>()
  // Requests refused and logged: checked again on each pass, in case the user's accounts change, but told once.
  const refused = new Set<string>()
  // Refusals told to lebroker since the stream last opened: told again after, as lebroker keeps them in memory only.
  const declined = new Set<string>()
  const attempts = new Map<string, number>()
  let running: Promise<void> | null = null
  let again = false
  let streamUp = false
  let lastPass = Number.NEGATIVE_INFINITY
  let stopPolling: (() => void) | null = null
  let watching: Promise<void> | null = null

  async function handle({ request, accounts, session }: HandleProps): Promise<void> {
    const logged = { id: request.id, kind: request.kind, venue: request.venue }
    const signable = signableRequest({ request, user: session.user, accounts, walletChainId: chainId, appOrigin })
    if (!signable.ok) {
      if (!refused.has(request.id)) {
        refused.add(request.id)
        log({ event: LogEvent.REFUSED, wallet: wallet.info, request: logged, fields: { reason: signable.refusal } })
      }
      await decline({ id: request.id, reason: signable.refusal, logged })
      return
    }
    let signature
    try {
      signature = await signPayload({ account: wallet.account(), payload: request.payload, chainId: signable.summary.chainId })
    } catch (error) {
      done.add(request.id)
      log({ event: LogEvent.FAILED, wallet: wallet.info, request: logged, fields: { step: FailedStep.SIGN, error: errorText({ error }) } })
      return
    }
    try {
      await client.sign({ id: request.id, signature })
      done.add(request.id)
      log({
        event: LogEvent.SIGNED,
        wallet: wallet.info,
        request: logged,
        fields: { action: signable.summary.action, chainId: signable.summary.chainId },
      })
    } catch (error) {
      const attempt = (attempts.get(request.id) ?? 0) + 1
      attempts.set(request.id, attempt)
      const status = error instanceof ApiError ? error.status : null
      const retry = (status === null || status >= SERVER_ERROR_STATUS) && attempt < MAX_SEND_ATTEMPTS
      if (!retry) {
        done.add(request.id)
      }
      log({
        event: LogEvent.FAILED,
        wallet: wallet.info,
        request: logged,
        fields: { step: FailedStep.SEND, error: errorText({ error }), status, attempt, retry },
      })
    }
  }

  /**
   * Tells lebroker the allowlist refused a request, once per stream: the user's pages then offer it in the browser at
   * once, and their channels hear it, rather than waiting on this signer.
   */
  async function decline({ id, reason, logged }: DeclineProps): Promise<void> {
    if (declined.has(id)) {
      return
    }
    declined.add(id)
    try {
      await client.decline({ id, reason: reason.slice(0, MAX_DECLINE_REASON) })
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null
      log({
        event: LogEvent.FAILED,
        wallet: wallet.info,
        request: logged,
        fields: { step: FailedStep.DECLINE, error: errorText({ error }), status },
      })
    }
  }

  async function passOnce(): Promise<void> {
    lastPass = now()
    let listed
    try {
      listed = await client.signatureRequests()
    } catch (error) {
      log({ event: LogEvent.READ_FAILED, wallet: wallet.info, fields: { subject: ReadSubject.REQUESTS, error: errorText({ error }) } })
      return
    }
    const waiting = listed.requests.filter(
      request => request.state === SignatureRequestState.WAITING && Date.parse(request.expiresAt) > now() && !done.has(request.id),
    )
    const session = client.session()
    if (waiting.length === 0 || session === null) {
      return
    }
    // The user's accounts as the service lists them now, as the web reads them before each signature: where funds may go.
    let accounts
    try {
      accounts = (await client.accounts()).accounts
    } catch (error) {
      log({ event: LogEvent.READ_FAILED, wallet: wallet.info, fields: { subject: ReadSubject.ACCOUNTS, error: errorText({ error }) } })
      return
    }
    for (const request of waiting) {
      if (stopping.signal.aborted) {
        return
      }
      await handle({ request, accounts, session })
    }
  }

  /** One pass at a time: a call while one runs asks for one more after it, and waits for that one. */
  function pass(): Promise<void> {
    if (running !== null) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await passOnce()
      } while (again && !stopping.signal.aborted)
    })().finally(() => {
      running = null
    })
    return running
  }

  /** The service's event stream, opened again whenever it drops: each `signature-requests` event starts a pass. */
  async function watchStream(): Promise<void> {
    let wait = STREAM_RETRY_FIRST_MS
    while (!stopping.signal.aborted) {
      try {
        const response = await client.events({ signal: stopping.signal })
        if (response.body !== null) {
          streamUp = true
          wait = STREAM_RETRY_FIRST_MS
          // A new stream may be a restarted service's, which forgot what this signer refused.
          declined.clear()
          log({ event: LogEvent.STREAM, wallet: wallet.info, fields: { stage: StreamStage.CONNECTED } })
          // What was asked while it was down.
          void pass()
          await readEvents({
            body: response.body,
            onEvent: name => {
              if (name === SIGNATURE_REQUESTS_EVENT) {
                void pass()
              }
            },
          })
        }
      } catch (error) {
        if (!stopping.signal.aborted && !streamUp) {
          log({ event: LogEvent.READ_FAILED, wallet: wallet.info, fields: { subject: ReadSubject.EVENTS, error: errorText({ error }) } })
        }
      }
      if (streamUp) {
        streamUp = false
        if (!stopping.signal.aborted) {
          log({ event: LogEvent.STREAM, wallet: wallet.info, fields: { stage: StreamStage.DROPPED } })
        }
      }
      if (stopping.signal.aborted) {
        return
      }
      await timers.sleep({ ms: wait, signal: stopping.signal })
      wait = Math.min(wait * 2, STREAM_RETRY_MAX_MS)
    }
  }

  function start(): void {
    log({ event: LogEvent.STARTED, wallet: wallet.info })
    // Polling covers the stream's absence, and its silence now and then.
    stopPolling = timers.every({
      ms: POLL_MS,
      run: () => {
        if (!streamUp || now() - lastPass >= SAFETY_POLL_MS) {
          void pass()
        }
      },
    })
    watching = (async () => {
      try {
        await client.signIn()
      } catch (error) {
        // The first pass or the stream signs in again; until then, polling tries.
        log({ event: LogEvent.SESSION_FAILED, wallet: wallet.info, fields: { subject: ReadSubject.SIGN_IN, error: errorText({ error }) } })
      }
      await watchStream()
    })()
  }

  async function stop(): Promise<void> {
    stopping.abort()
    stopPolling?.()
    await Promise.all([running, watching])
    log({ event: LogEvent.STOPPED, wallet: wallet.info })
  }

  return { start, pass, stop }
}

export { createWalletSigner }
