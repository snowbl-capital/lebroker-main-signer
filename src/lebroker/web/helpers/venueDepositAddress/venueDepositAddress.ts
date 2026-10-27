import { ChainId, VenueId } from "../../../core/model"
import { DEPOSIT_ADDRESS_TIMEOUT_MS, LIGHTER_INTENT_PATH } from "../../../signer/model"
import { LIGHTER_API_URL } from "../../../venues/model"
import { VenueDepositAddressError } from "./enums"
import { lighterIntent } from "./schema"
import type { VenueDepositAddressProps } from "./types"

/**
 * A venue's deposit address for Main's own address, read by the signing side itself from the venue, never from
 * lebroker: Lighter's intent address on Arbitrum, made for Main's L1 address with no key, which credits Main's
 * Lighter account. A venue that has none, doesn't answer in time, or answers something else, throws: nothing is signed.
 */
async function venueDepositAddress({ venue, address }: VenueDepositAddressProps): Promise<string> {
  if (venue !== VenueId.LIGHTER) {
    throw new Error(VenueDepositAddressError.NONE)
  }
  const query = new URLSearchParams({
    chain_id: String(ChainId.ARBITRUM),
    from_addr: address,
    amount: "0",
    is_external_deposit: "true",
  })
  const response = await fetch(`${LIGHTER_API_URL}${LIGHTER_INTENT_PATH}?${query.toString()}`, {
    method: "POST",
    // Lighter's own answer only: a redirect elsewhere reads nothing.
    redirect: "error",
    signal: AbortSignal.timeout(DEPOSIT_ADDRESS_TIMEOUT_MS),
  }).catch(() => {
    throw new Error(VenueDepositAddressError.UNREAD)
  })
  const answer: unknown = response.ok ? await response.json().catch(() => null) : null
  const parsed = lighterIntent.safeParse(answer)
  if (!parsed.success) {
    throw new Error(VenueDepositAddressError.UNREAD)
  }
  return parsed.data.intent_address
}

export { venueDepositAddress }
