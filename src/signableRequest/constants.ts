import { ASTER_TRANSFER_CHAIN_ID, CHAINS, ENVIRONMENT_SLOTS } from "@lamarge/sdk/protocol"
import { Network, VenueId } from "../lebroker/core/model"
import { AsterParam, SUB_ACCOUNT_PROOF_DOMAIN } from "../lebroker/signer/model"
import { ASTER_APPROVAL_CHAIN_ID, ASTER_SIGN_CHAIN_IDS, ASTER_WITHDRAWAL_DOMAIN, POLYMARKET_SIGN_DOMAIN } from "../lebroker/venues/model"
import { LaMargeWord, SignSummaryText } from "./enums"
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

/**
 * What a LaMarge send on Polymarket signs: its operation's typed data (`Op`), whose domain names no contract, and
 * the one operation it hashes, an internal transfer, in LaMarge's SDK's words.
 */
const OP_TYPE = "Op"
const OP_INTERNAL_TRANSFER = "internalTransfer"

/** The EIP-712 domain's own fields, in the order a wallet writes them: what the LaMarge SDK's checks expect named. */
const EIP712_DOMAIN_FIELDS: readonly { name: string; type: string }[] = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
]

/**
 * LaMarge's deployments Main signs for: production's and the dev one's, each by its app, which Main's sign-in names as
 * LaMarge's SDK checks it; its own slots on Main's venue accounts, its Aster agent's name and its Lighter key's index;
 * and its own escrows, production's one proxy on HyperEVM and Polygon, the dev one's on each. Aster keeps one agent per
 * name and Lighter one key per index: approving or registering the other deployment's would replace that deployment's,
 * and a payment or a permit to the other's escrow would go to another environment, so a request is held to the
 * deployment it says it's for.
 */
const LAMARGE_DEPLOYMENTS: readonly LaMargeDeploymentPins[] = [
  {
    appOrigin: "https://app.lamarge.trade",
    ...ENVIRONMENT_SLOTS.production,
    escrows: ["0x3100b7b49C0F9631c6AF25877b5A4E13a47AFad6"],
  },
  {
    appOrigin: "https://app.dev.lamarge.trade",
    ...ENVIRONMENT_SLOTS.development,
    escrows: ["0x948E65c40442d935d4ee990BDbD01BdD825c4873", "0xA3FCA394739Ec4B984e908BD7A3c3b72d0ED77D1"],
  },
]

/** How long a LaMarge permit's deadline may run, in seconds, as lebroker's mover allows it. */
const LAMARGE_PERMIT_SECONDS = 600

/** Basis points in a whole. */
const BPS = 10_000n

/**
 * lebroker's gas reserve on each deployment, by the origin its app is served from: the one address Main's payment for
 * gas may go to there, as that deployment's account process logged it (`executor.gas_reserve`), never a request's
 * word. Null until the deployment's reserve is funded: Main buys no gas there, and no screen offers it. A deployment
 * not listed, a local stack's included, pins none.
 */
const GAS_RESERVE_DEPLOYMENTS: readonly GasReservePin[] = [
  { appOrigin: "https://app.leneutre.trade", reserve: "0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F" },
  // The same deployment under the name it moved from, which a Main signer may still name: one host, one reserve.
  { appOrigin: "https://lebroker.dev.lamarge.trade", reserve: "0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F" },
  { appOrigin: "https://app.dev.leneutre.trade", reserve: null },
]

/**
 * The most Main pays the gas reserve at once, in USDC: the signer's hard cap on a gas purchase's payment
 * (`GAS_PURCHASE_MAX_USD`), which its settings sit under.
 */
const GAS_RESERVE_PAYMENT_MAX_USD = 20

/** Hyperliquid names its network in every user-signed action: lebroker runs on mainnet only. */
const HYPERLIQUID_MAINNET = "Mainnet"

/** The token Hyperliquid's transfers and withdrawals move. */
const USDC = "USDC"

/**
 * What Main's withdrawal straight into a venue's deposit address for Main does, by venue: only the venues the
 * signer's least lists (`WITHDRAWAL_DEPOSIT_MIN_USD`) take one.
 */
const DEPOSIT_WITHDRAWAL_ACTIONS: Partial<Record<VenueId, SignSummaryText>> = {
  [VenueId.LIGHTER]: SignSummaryText.WITHDRAW_INTO_LIGHTER,
}

export {
  ASTER_APPROVAL_FIELDS,
  ASTER_TRANSFER_FIELDS,
  BPS,
  CLOCK_SLACK_MS,
  DEPOSIT_WITHDRAWAL_ACTIONS,
  EIP712_DOMAIN_FIELDS,
  GAS_RESERVE_DEPLOYMENTS,
  GAS_RESERVE_PAYMENT_MAX_USD,
  OP_INTERNAL_TRANSFER,
  OP_TYPE,
  HYPERLIQUID_MAINNET,
  LAMARGE_DEPLOYMENTS,
  LAMARGE_PERMIT_SECONDS,
  SIGNATURE_CHAIN_IDS,
  USDC,
}
