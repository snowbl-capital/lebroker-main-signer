import { Network } from "../../core/model"

/** The same, for actions the user signs directly, such as moving collateral. */
const HYPERLIQUID_CHAINS: Record<Network, string> = { [Network.MAINNET]: "Mainnet", [Network.TESTNET]: "Testnet" }

/** The chain the wallet signs user actions on; any chain works, Hyperliquid's own tools use this one. */
const SIGNATURE_CHAIN_ID = "0x66eee"

const USER_SIGNED_DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: Number(SIGNATURE_CHAIN_ID),
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const

const WITHDRAW_TYPES = {
  "HyperliquidTransaction:Withdraw": [
    { name: "hyperliquidChain", type: "string" },
    { name: "destination", type: "string" },
    { name: "amount", type: "string" },
    { name: "time", type: "uint64" },
  ],
} as const

const SEND_ASSET_TYPES = {
  "HyperliquidTransaction:SendAsset": [
    { name: "hyperliquidChain", type: "string" },
    { name: "destination", type: "string" },
    { name: "sourceDex", type: "string" },
    { name: "destinationDex", type: "string" },
    { name: "token", type: "string" },
    { name: "amount", type: "string" },
    { name: "fromSubAccount", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
} as const

/**
 * `sendAsset` moves USDC from spot to spot (D19, tested on mainnet on 18 October 2026, on a unified account). Its token
 * is named as Hyperliquid's API spells it: name and token id.
 */
const SEND_ASSET_DEX = "spot"

const SEND_ASSET_USDC = "USDC:0x6d1e7cde53ba9467b783cb7c530ce054"

/**
 * The main dex has no name. HIP-3 dexes, deployed by others on Hyperliquid, name their markets `dex:COIN`: xyz:AAPL,
 * xyz:GOLD. Requests about one of their markets name it so; requests about a whole dex add `dex`.
 */
const MAIN_DEX = ""

/**
 * The balances `sendAsset` moves between: the spot balance, where a unified or portfolio-margin account holds its
 * collateral, or the main dex's perps, where a standard account holds its own.
 */
const SEND_ASSET_DEXES: readonly string[] = [SEND_ASSET_DEX, MAIN_DEX]

const APPROVE_AGENT_TYPES = {
  "HyperliquidTransaction:ApproveAgent": [
    { name: "hyperliquidChain", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "agentName", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
} as const

/** An account's mode set by its own key, as Hyperliquid's Python SDK types `userSetAbstraction`. */
const USER_SET_ABSTRACTION_TYPES = {
  "HyperliquidTransaction:UserSetAbstraction": [
    { name: "hyperliquidChain", type: "string" },
    { name: "user", type: "address" },
    { name: "abstraction", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
} as const

export {
  APPROVE_AGENT_TYPES,
  HYPERLIQUID_CHAINS,
  MAIN_DEX,
  SEND_ASSET_DEX,
  SEND_ASSET_DEXES,
  SEND_ASSET_TYPES,
  SEND_ASSET_USDC,
  SIGNATURE_CHAIN_ID,
  USER_SET_ABSTRACTION_TYPES,
  USER_SIGNED_DOMAIN,
  WITHDRAW_TYPES,
}
