import { getAddress, zeroHash } from "viem"
import { ChainId, DAY_MS } from "../../core/model"

/** GMX's router for a subaccount's express orders on Arbitrum: the contract Main's approval is signed for. */
const SUBACCOUNT_ROUTER = getAddress("0xfD0596f708d9D950E0eF7b5d191e5F8e55b8a67f")

/** gmx-synthetics `Keys.SUBACCOUNT_ORDER_ACTION`, keccak256(abi.encode("SUBACCOUNT_ORDER_ACTION")): orders only. */
const SUBACCOUNT_ORDER_ACTION = "0x2a0791687fd34f2095c484a9fa4e25057d3ef79a97fcd8c61436047a7bdf4cbe"

/** No integration of GMX's own names the approval: the zero hash, as GMX's API prepares it. */
const NO_INTEGRATION = zeroHash

/** The domain GMX's relay routers check a signature under: the subaccount router on Arbitrum, Main's wallet on that chain. */
const APPROVAL_DOMAIN = {
  name: "GmxBaseGelatoRelayRouter",
  version: "1",
  chainId: ChainId.ARBITRUM,
  verifyingContract: SUBACCOUNT_ROUTER,
} as const

const APPROVAL_PRIMARY_TYPE = "SubaccountApproval"

/** gmx-synthetics `SubaccountApproval`, as `RelayUtils` hashes it. */
const APPROVAL_TYPES = {
  [APPROVAL_PRIMARY_TYPE]: [
    { name: "subaccount", type: "address" },
    { name: "shouldAdd", type: "bool" },
    { name: "expiresAt", type: "uint256" },
    { name: "maxAllowedCount", type: "uint256" },
    { name: "actionType", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "desChainId", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "integrationId", type: "bytes32" },
  ],
} as const

/** How long Main's approval of lebroker's GMX subaccount lasts: 90 days, renewed 14 days ahead like the other venues'. */
const SUBACCOUNT_TTL_MS = 90 * DAY_MS

/**
 * The order actions GMX lets the subaccount take each day of its approval: every order, change or cancel counts one.
 * A strategy's entry, its guards' ladders and its closes stay far under 200 a day; the cap bounds what a key misused
 * could send, as its outputs always go to Main.
 */
const SUBACCOUNT_ACTIONS_PER_DAY = 200

/** The order actions one approval allows, over its whole term: what Main's wallet is asked to sign at most. */
const SUBACCOUNT_MAX_ACTIONS = Math.ceil(SUBACCOUNT_TTL_MS / DAY_MS) * SUBACCOUNT_ACTIONS_PER_DAY

export {
  APPROVAL_DOMAIN,
  APPROVAL_PRIMARY_TYPE,
  APPROVAL_TYPES,
  NO_INTEGRATION,
  SUBACCOUNT_ACTIONS_PER_DAY,
  SUBACCOUNT_MAX_ACTIONS,
  SUBACCOUNT_ORDER_ACTION,
  SUBACCOUNT_ROUTER,
  SUBACCOUNT_TTL_MS,
}
