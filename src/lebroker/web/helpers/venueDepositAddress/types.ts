import type { VenueId } from "../../../core/model"
import type { SignedBybitDeposit } from "../../hooks/bybitKey/useBybitKeyQuery/types"

/** `address`: the beneficiary's L1 address. Signing flows omit `chainId` and keep their pinned Arbitrum route. */
type VenueDepositAddressProps = { venue: VenueId; address: string; chainId?: number }

/** The chain the deposit is paid on, by its EVM id, and Main's address, whose signature of the address is required. */
type BybitDepositAddressProps = { chainId: number; main: string }

/** Main's signature of its Bybit deposit address, as the executor kept it, and Main's address. */
type SignedByMainProps = { signed: SignedBybitDeposit; main: string }

export type { BybitDepositAddressProps, SignedByMainProps, VenueDepositAddressProps }
