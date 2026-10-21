import { ASTER_TRANSFER_CHAIN_ID, CHAINS } from "@lamarge/sdk/protocol"
import { Network } from "../lebroker/core/model"
import { AsterParam, SUB_ACCOUNT_PROOF_DOMAIN } from "../lebroker/signer/model"
import { ASTER_APPROVAL_CHAIN_ID, ASTER_SIGN_CHAIN_IDS, ASTER_WITHDRAWAL_DOMAIN, POLYMARKET_SIGN_DOMAIN } from "../lebroker/venues/model"
import { LaMargeWord } from "./enums"
import type { GasReservePin, LaMargeDeploymentPins } from "./types"

/** Hyperliquid's own chain for its user-signed actions, which lebroker names when the wallet shows none (Arbitrum). */
const HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID = 42161

/**
 * Every chain the rules let a request be signed on, besides the one the wallet shows: the chains each rule names, as
 * they name them. LaMarge's venues sign on their chains but Lighter, whose payments are messages. A request whose
 * chain isn't here is refused, and the wallet can switch to each one (`WALLET_CHAINS`, `SIGNING_NETWORKS`).
 */
const SIGNATURE_CHAIN_IDS: ReadonlySet<number> = new Set([
  HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID,
  ASTER_APPROVAL_CHAIN_ID,
  ASTER_SIGN_CHAIN_IDS[Network.MAINNET],
  ASTER_WITHDRAWAL_DOMAIN.chainId,
  POLYMARKET_SIGN_DOMAIN.chainId,
  SUB_ACCOUNT_PROOF_DOMAIN.chainId,
  ASTER_TRANSFER_CHAIN_ID,
  ...Object.entries(CHAINS)
    .filter(entry => entry[0] !== LaMargeWord.LIGHTER)
    .map(entry => entry[1].id),
])

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

/**
 * LaMarge's deployments Main signs for: production's and the dev one's, each by its app, which Main's sign-in names as
 * LaMarge's SDK checks it, and its Aster agent's name. Aster keeps one agent per name: approving the other deployment's
 * name would revoke that deployment's agent, so a request is held to the deployment it says it's for.
 */
const LAMARGE_DEPLOYMENTS: readonly LaMargeDeploymentPins[] = [
  { appOrigin: "https://app.lamarge.trade", asterAgentName: "LaMarge" },
  { appOrigin: "https://app.dev.lamarge.trade", asterAgentName: "LaMargeDev" },
]

/** How long a LaMarge permit's deadline may run, in seconds, as lebroker's mover allows it. */
const LAMARGE_PERMIT_SECONDS = 600

/**
 * lebroker's gas reserve on each deployment, by the origin its app is served from (D51, phase 6): the one address
 * Main's payment for gas may go to there, as that deployment's account process logged it (`executor.gas_reserve`),
 * never a request's word. Null until the deployment's reserve exists: Main buys no gas there, and no screen offers it.
 * A deployment not listed, a local stack's included, pins none.
 */
const GAS_RESERVE_DEPLOYMENTS: readonly GasReservePin[] = [
  { appOrigin: "https://lebroker.dev.lamarge.trade", reserve: "0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F" },
  { appOrigin: "https://lebroker.lamarge.trade", reserve: null },
]

/**
 * The most Main pays the gas reserve at once, in USDC: the signer's hard cap on a gas purchase's payment
 * (`GAS_PURCHASE_MAX_USD`), which its settings sit under.
 */
const GAS_RESERVE_PAYMENT_MAX_USD = 20

/** Hyperliquid names its network in every user-signed action: lebroker runs on mainnet only (D9). */
const HYPERLIQUID_MAINNET = "Mainnet"

/** The token Hyperliquid's transfers and withdrawals move. */
const USDC = "USDC"

export {
  ASTER_APPROVAL_FIELDS,
  ASTER_TRANSFER_FIELDS,
  CLOCK_SLACK_MS,
  EIP712_DOMAIN_FIELDS,
  GAS_RESERVE_DEPLOYMENTS,
  GAS_RESERVE_PAYMENT_MAX_USD,
  HYPERLIQUID_MAINNET,
  LAMARGE_DEPLOYMENTS,
  LAMARGE_PERMIT_SECONDS,
  SIGNATURE_CHAIN_IDS,
  USDC,
}
