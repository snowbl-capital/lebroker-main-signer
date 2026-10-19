/** The event the service pushes when one of the user's signature requests is asked or settled (D37). */
const SIGNATURE_REQUESTS_EVENT = "signature-requests"

/** How often the requests are read while the event stream is down: every few seconds. */
const POLL_MS = 5_000

/** How often they're read with the stream up too, in case an event was missed: the web's banner reads them every minute. */
const SAFETY_POLL_MS = 60_000

/** After the stream drops, it's opened again after this long, doubled at each failure up to the most. */
const STREAM_RETRY_FIRST_MS = 1_000
const STREAM_RETRY_MAX_MS = 30_000

/**
 * A signature the service couldn't send on (it didn't answer, or its venue failed: 5xx) is sent again on the next
 * passes, this many times in all. A refusal of the signature itself (4xx) is final: the request stays for the browser.
 */
const MAX_SEND_ATTEMPTS = 3

/** The status from which a refusal is the service's or its venue's trouble, not the signature's. */
const SERVER_ERROR_STATUS = 500

export {
  MAX_SEND_ATTEMPTS,
  POLL_MS,
  SAFETY_POLL_MS,
  SERVER_ERROR_STATUS,
  SIGNATURE_REQUESTS_EVENT,
  STREAM_RETRY_FIRST_MS,
  STREAM_RETRY_MAX_MS,
}
