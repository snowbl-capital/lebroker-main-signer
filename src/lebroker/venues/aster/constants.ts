import { Network } from "../../core/model"

/** The chain id in the EIP-712 domain of the agent's signed requests, per network. */
const SIGN_CHAIN_IDS: Record<Network, number> = { [Network.MAINNET]: 1666, [Network.TESTNET]: 714 }

/** The owner's EVM wallet signs an agent's approval on this chain id, on either network. */
const APPROVAL_CHAIN_ID = 56

const SIGN_DOMAIN = { name: "AsterSignTransaction", version: "1", verifyingContract: "0x0000000000000000000000000000000000000000" } as const

const MESSAGE_TYPES = { Message: [{ name: "msg", type: "string" }] } as const

const AGENT_NAME = "lebroker"

/** An approval lasts this long; once Aster forgets the agent, the trader approves it again. */
const AGENT_TTL_MS = 180 * 24 * 60 * 60 * 1000

/**
 * What the owner signs to withdraw: an `Action` on the destination chain's id, its field names with their spaces, as
 * Aster's site and LaMarge sign it. lebroker withdraws USDC to Arbitrum, tested on mainnet on 18 October 2026.
 */
const WITHDRAWAL_DOMAIN = {
  name: "Aster",
  version: "1",
  chainId: 42161,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const

const WITHDRAWAL_TYPES = {
  Action: [
    { name: "type", type: "string" },
    { name: "destination", type: "address" },
    { name: "destination Chain", type: "string" },
    { name: "token", type: "string" },
    { name: "amount", type: "string" },
    { name: "fee", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "aster chain", type: "string" },
  ],
} as const

/** The withdrawal's fixed fields: its kind, the chain and token it pays out, and Aster's own chain. */
const WITHDRAWAL_ACTION = { type: "Withdraw", chain: "Arbitrum", token: "USDC", asterChain: "Mainnet" } as const

/** Collateral moves between spot and futures in the futures' margin asset. */
const MARGIN_ASSET = "USDT"

export {
  AGENT_NAME,
  AGENT_TTL_MS,
  APPROVAL_CHAIN_ID,
  MARGIN_ASSET,
  MESSAGE_TYPES,
  SIGN_CHAIN_IDS,
  SIGN_DOMAIN,
  WITHDRAWAL_ACTION,
  WITHDRAWAL_DOMAIN,
  WITHDRAWAL_TYPES,
}
