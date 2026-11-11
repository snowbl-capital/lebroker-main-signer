import { getAddress, maxUint256, type Address } from "viem"
import { ChainId } from "../../../core/model"
import { ARBITRUM_USDC } from "../../constants"

/**
 * GMX's `Router` on Arbitrum: an express order's collateral and relay fee are pulled from the account's wallet through
 * it, so the wallet's USDC allowance to it must cover them (docs.gmx.io, contracts' addresses).
 */
const TOKEN_ROUTER: Address = getAddress("0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6")

/** Native USDC's EIP-2612 domain on Arbitrum, as its contract reads it (`name()` "USD Coin", `version()` "2"). */
const PERMIT_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: ChainId.ARBITRUM,
  verifyingContract: getAddress(ARBITRUM_USDC.address),
} as const

const PERMIT_PRIMARY_TYPE = "Permit"

/** EIP-2612's `Permit`. */
const PERMIT_TYPES = {
  [PERMIT_PRIMARY_TYPE]: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const

/**
 * What a permit allows GMX's Router: all of it, as GMX's app approves it, so the account's first order sets an allowance
 * every later one finds. The Router moves tokens only for GMX's own contracts, which take them for the account's orders.
 */
const PERMIT_VALUE = maxUint256

export { PERMIT_DOMAIN, PERMIT_PRIMARY_TYPE, PERMIT_TYPES, PERMIT_VALUE, TOKEN_ROUTER }
