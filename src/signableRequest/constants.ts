import { AsterParam } from "../lebroker/signer/model"

/** Hyperliquid's own chain for its user-signed actions, which lebroker names when the wallet shows none (Arbitrum). */
const HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID = 42161

/** What the host's clock may run ahead of the browser's when it sets an end: an approval never lasts longer than this beyond its term. */
const CLOCK_SLACK_MS = 60 * 60 * 1000

/** Main's approval of lebroker's trading agent on Aster: exactly these parameters, in this order. */
const ASTER_APPROVAL_FIELDS: readonly string[] = [
  AsterParam.USER,
  AsterParam.NONCE,
  AsterParam.AGENT_NAME,
  AsterParam.AGENT_ADDRESS,
  AsterParam.EXPIRED,
  AsterParam.SIGNATURE_CHAIN_ID,
  AsterParam.CAN_SPOT_TRADE,
  AsterParam.CAN_PERP_TRADE,
  AsterParam.CAN_WITHDRAW,
]

/** A transfer between two wallets' Spot on Aster, signed by Main's wallet: exactly these parameters, in this order. */
const ASTER_TRANSFER_FIELDS: readonly string[] = [
  AsterParam.ASSET,
  AsterParam.AMOUNT,
  AsterParam.TO_ADDRESS,
  AsterParam.CLIENT_TRAN_ID,
  AsterParam.NONCE,
  AsterParam.USER,
]

/** The EIP-712 domain's own fields, in the order a wallet writes them: what the LaMarge SDK's checks expect named. */
const EIP712_DOMAIN_FIELDS: readonly { name: string; type: string }[] = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
]

/** LaMarge's apps Main signs in to, as LaMarge's SDK checks the sign-in: production's, and the dev deployment's. */
const LAMARGE_APP_ORIGINS: readonly string[] = ["https://app.lamarge.trade", "https://app.dev.lamarge.trade"]

/** How long a LaMarge permit's deadline may run, in seconds, as lebroker's mover allows it. */
const LAMARGE_PERMIT_SECONDS = 600

/** Hyperliquid names its network in every user-signed action: lebroker runs on mainnet only (D9). */
const HYPERLIQUID_MAINNET = "Mainnet"

/** The token Hyperliquid's transfers and withdrawals move. */
const USDC = "USDC"

export {
  ASTER_APPROVAL_FIELDS,
  ASTER_TRANSFER_FIELDS,
  CLOCK_SLACK_MS,
  EIP712_DOMAIN_FIELDS,
  HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID,
  HYPERLIQUID_MAINNET,
  LAMARGE_APP_ORIGINS,
  LAMARGE_PERMIT_SECONDS,
  USDC,
}
