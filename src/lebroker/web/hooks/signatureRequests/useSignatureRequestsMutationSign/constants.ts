import { SignSummaryText } from "../../../../../signableRequest/enums"

/**
 * What the allowlist reads as a LaMarge take's payment, which both LaMarge deployments attest (their attesters pinned in
 * LaMarge's SDK): Main's wallet signs one only with its attestation verified.
 */
const ATTESTED_TAKE_ACTIONS: ReadonlySet<string> = new Set([
  SignSummaryText.LAMARGE_PAYMENT,
  SignSummaryText.LAMARGE_ASTER_TAKE,
  SignSummaryText.LAMARGE_LIGHTER_TAKE,
])

export { ATTESTED_TAKE_ACTIONS }
