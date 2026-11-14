import { ChainId, VenueId } from "../../../core/model"
import {
  DEPOSIT_ADDRESS_TIMEOUT_MS,
  LIGHTER_INTENT_PATH,
  MAIN_BYBIT_DEPOSIT_ADDRESS_PROOF_TYPES,
  SUB_ACCOUNT_PROOF_DOMAIN,
} from "../../../signer/model"
import { LIGHTER_API_URL } from "../../../venues/model"
import { getAddress, isAddress, isAddressEqual, isHex, recoverTypedDataAddress } from "viem"
import { ApiPath } from "../../enums"
import { fetchApi } from "../../helpers/fetchApi/fetchApi"
import { BybitDepositState } from "../../hooks/bybitKey/useBybitKeyQuery/enums"
import { bybitDepositAnswer } from "../../hooks/bybitKey/useBybitKeyQuery/schema"
import { VenueDepositAddressError } from "./enums"
import { lighterIntent } from "./schema"
import type { BybitDepositAddressProps, SignedByMainProps, VenueDepositAddressProps } from "./types"

/**
 * Lighter's deposit address for a beneficiary's L1 address, read from Lighter with no key. Direct deposits name a
 * supported network; signing flows keep their Arbitrum default and read the destination independently of the service.
 * Bybit's for Main is the one Main signed (`MainBybitDepositAddress`), on Arbitrum only: the executor keeps Main's
 * signature, and the browser takes the address only once that signature recovers Main. The executor's word alone never
 * passes. GMX's is the beneficiary's own address on Arbitrum: its account is the wallet itself, and USDC there its margin.
 */
async function venueDepositAddress({ venue, address, chainId = ChainId.ARBITRUM }: VenueDepositAddressProps): Promise<string> {
  if (venue === VenueId.BYBIT) {
    return await bybitDepositAddress({ chainId, main: address })
  }
  if (venue === VenueId.GMX && chainId === ChainId.ARBITRUM) {
    return getAddress(address)
  }
  if (venue !== VenueId.LIGHTER) {
    throw new Error(VenueDepositAddressError.NONE)
  }
  const query = new URLSearchParams({
    chain_id: String(chainId),
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

/**
 * Main's USDC deposit address on Bybit, the one Main signed, on `chainId`: refused unsigned, once Bybit shows another,
 * and unless Main's signature of it recovers Main here, whatever the executor says.
 */
async function bybitDepositAddress({ chainId, main }: BybitDepositAddressProps): Promise<string> {
  const read = await fetchApi({ path: ApiPath.BYBIT_DEPOSIT_ADDRESS, schema: bybitDepositAnswer }).catch(() => null)
  if (read === null) {
    throw new Error(VenueDepositAddressError.UNREAD)
  }
  const signed = read.deposit.signed
  if (signed === null) {
    throw new Error(VenueDepositAddressError.BYBIT_UNSIGNED)
  }
  if (read.deposit.state === BybitDepositState.CHANGED) {
    throw new Error(VenueDepositAddressError.BYBIT_CHANGED)
  }
  if (signed.chainId !== chainId || !(await signedByMain({ signed, main }))) {
    throw new Error(VenueDepositAddressError.BYBIT_NOT_MAIN)
  }
  return getAddress(signed.depositAddress)
}

/** Whether Main's own key signed this deposit address for Main: its `MainBybitDepositAddress`, recovered here. */
async function signedByMain({ signed, main }: SignedByMainProps): Promise<boolean> {
  if (!isAddress(main) || !isAddress(signed.main) || !isAddress(signed.depositAddress) || !isHex(signed.signature)) {
    return false
  }
  if (!isAddressEqual(signed.main, main)) {
    return false
  }
  const signer = await recoverTypedDataAddress({
    domain: SUB_ACCOUNT_PROOF_DOMAIN,
    types: MAIN_BYBIT_DEPOSIT_ADDRESS_PROOF_TYPES,
    primaryType: "MainBybitDepositAddress",
    message: {
      owner: signed.owner,
      account: signed.account,
      main: signed.main,
      depositAddress: signed.depositAddress,
      chainId: BigInt(signed.chainId),
      nonce: BigInt(signed.nonce),
      deadline: BigInt(signed.deadline),
    },
    signature: signed.signature,
  }).catch(() => null)
  return signer !== null && isAddressEqual(signer, main)
}

export { venueDepositAddress }
