import { VenueId } from "../../core/model"

/** Lighter's intent address, made for an L1 address: USDC sent there credits that address's Lighter account. */
const LIGHTER_INTENT_PATH = "/api/v1/createIntentAddress"

/** How long a venue's answer may take before the deposit isn't signed, in ms. */
const DEPOSIT_ADDRESS_TIMEOUT_MS = 5_000

/**
 * The least a Hyperliquid withdrawal paid straight into a venue's deposit address carries, in USDC, by venue:
 * Hyperliquid's $1 fee comes out of it, then the venue credits the rest only from its own least. Lighter's intent
 * address takes 5 USDC at least. A venue not listed is paid no such withdrawal. The signer holds a sub-account's to it,
 * and Main's wallet Main's own, which opens Main's Lighter from inside.
 */
const WITHDRAWAL_DEPOSIT_MIN_USD: Partial<Record<VenueId, number>> = { [VenueId.LIGHTER]: 6 }

export { DEPOSIT_ADDRESS_TIMEOUT_MS, LIGHTER_INTENT_PATH, WITHDRAWAL_DEPOSIT_MIN_USD }
