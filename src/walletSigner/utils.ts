import { SignaturePayloadKind } from "../lebroker/accounts/model"
import { venueDepositAddress } from "../lebroker/web/helpers/venueDepositAddress/venueDepositAddress"
import type { ReadDepositAddress } from "../signableRequest/types"
import type { DepositAddressOfProps, ErrorTextProps, Timers } from "./types"

/** An error's words for a log line: its message, never the object, which may carry what it was called with. */
function errorText({ error }: ErrorTextProps): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * For Main's withdrawal straight into a venue's deposit address for Main (lebroker's D49, D56), that address, read by
 * the signer itself from the venue the request names, for the address of the wallet that signs, just before it signs;
 * nothing for any other request. A read that fails gives nothing either, and the allowlist then refuses the
 * withdrawal: nothing is signed.
 */
async function depositAddressOf(props: DepositAddressOfProps): Promise<ReadDepositAddress | undefined> {
  const payload = props.request.payload
  const venue = payload.kind === SignaturePayloadKind.TYPED_DATA ? payload.depositVenue : undefined
  if (venue === undefined) {
    return undefined
  }
  try {
    return { venue, address: await venueDepositAddress({ venue, address: props.address }) }
  } catch {
    return undefined
  }
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

export { depositAddressOf, errorText, runtimeTimers }
