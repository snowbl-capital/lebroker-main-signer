import { ASTER_TRANSFER_CHAIN_ID, CHAINS, ENVIRONMENT_SLOTS, ESCROW_DEPLOYMENTS } from "@lamarge/sdk/protocol"
import { ChainId, Network, VenueId } from "../lebroker/core/model"
import { AsterBoolean, AsterParam, SUB_ACCOUNT_PROOF_DOMAIN } from "../lebroker/signer/model"
import {
  ASTER_APPROVAL_CHAIN_ID,
  ASTER_SIGN_CHAIN_IDS,
  AsterAgentKind,
  ASTER_WITHDRAWAL_DOMAIN,
  GMX_APPROVAL_DOMAIN,
  POLYMARKET_SIGN_DOMAIN,
} from "../lebroker/venues/model"
import { LaMargeWord, SignSummaryText } from "./enums"
import type { AsterAgentTerms, LaMargeDeploymentPins } from "./types"

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
  GMX_APPROVAL_DOMAIN.chainId,
  ASTER_TRANSFER_CHAIN_ID,
  ...Object.entries(CHAINS)
    .filter(entry => entry[0] !== LaMargeWord.LIGHTER)
    .map(entry => entry[1].id),
])

/** What the host's clock may run ahead of the browser's when it sets an end: an approval never lasts longer than this beyond its term. */
const CLOCK_SLACK_MS = 60 * 60 * 1000

/**
 * lebroker's agents Main approves on Aster, by kind, each under its name in this deployment (`asterAgentNames`), with its
 * own permissions and what Main reads it does: the trading agent trades perps, the conversion agent converts USDC to
 * USDT on Spot before a move. Neither withdraws.
 */
const ASTER_AGENT_TERMS: readonly AsterAgentTerms[] = [
  { kind: AsterAgentKind.TRADING, spot: AsterBoolean.FALSE, perp: AsterBoolean.TRUE, action: SignSummaryText.APPROVE_ASTER_AGENT },
  {
    kind: AsterAgentKind.CONVERT,
    spot: AsterBoolean.TRUE,
    perp: AsterBoolean.FALSE,
    action: SignSummaryText.APPROVE_ASTER_CONVERT_AGENT,
  },
]

/** Main's approval of one of lebroker's agents on Aster: exactly these parameters, in this order. */
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
 * LaMarge's SDK checks it; its environment, whose attester signs its attestations; its own slots on Main's venue
 * accounts, its Aster agent's name and its Lighter key's index; and its own escrows, as LaMarge's SDK pins each
 * environment's: production's one proxy on HyperEVM and Polygon and its own on Arbitrum, the dev one's on each. Aster
 * keeps one agent per name and Lighter one key per index: approving or registering the other deployment's would replace
 * that deployment's, and a payment or a permit to the other's escrow would go to another environment, so a request is
 * held to the deployment it says it's for.
 */
const LAMARGE_DEPLOYMENTS: readonly LaMargeDeploymentPins[] = (
  [
    { appOrigin: "https://app.lamarge.trade", environment: "production" },
    { appOrigin: "https://app.dev.lamarge.trade", environment: "development" },
  ] as const
).map(deployment => ({
  ...deployment,
  ...ENVIRONMENT_SLOTS[deployment.environment],
  escrows: ESCROW_DEPLOYMENTS.filter(pinned => pinned.environment === deployment.environment).map(pinned => pinned.address),
}))

/** How long a LaMarge permit's deadline may run, in seconds, as lebroker's mover allows it. */
const LAMARGE_PERMIT_SECONDS = 600

/** Basis points in a whole. */
const BPS = 10_000n

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
  [VenueId.BYBIT]: SignSummaryText.WITHDRAW_INTO_BYBIT,
}

/**
 * What Main's CCTP send from Hyperliquid straight into a venue's deposit address does, by venue: only a venue measured to
 * credit a CCTP mint takes one, Bybit on Arbitrum.
 */
const CCTP_DEPOSIT_ACTIONS: Partial<Record<VenueId, SignSummaryText>> = { [VenueId.BYBIT]: SignSummaryText.CCTP_INTO_BYBIT }

/**
 * What Main's Lighter fast withdrawal straight into a venue's deposit address does, by venue: only Bybit, measured to
 * credit Lighter's pool contract on Arbitrum.
 */
const LIGHTER_FAST_ACTIONS: Partial<Record<VenueId, SignSummaryText>> = { [VenueId.BYBIT]: SignSummaryText.LIGHTER_FAST_INTO_BYBIT }

/** The least a Lighter fast withdrawal takes, in micro-USDC: 4 USDC (Lighter's docs). */
const LIGHTER_FAST_MIN_UNITS = 4_000_000n

/**
 * What Main's Polymarket bridge withdrawal straight into a venue's deposit address does, by venue: only Bybit, measured
 * to credit the bridge's payout.
 */
const POLYMARKET_BRIDGE_ACTIONS: Partial<Record<VenueId, SignSummaryText>> = {
  [VenueId.BYBIT]: SignSummaryText.POLYMARKET_BRIDGE_INTO_BYBIT,
}

/** The least Polymarket's bridge takes, in pUSD's millionths: 2 dollars. */
const POLYMARKET_BRIDGE_MIN_UNITS = 2_000_000n

/** The primary type of Main's withdrawal of its Polymarket Perps margin, which a bridge withdrawal into a venue asks first. */
const POLYMARKET_PERPS_WITHDRAW_TYPE = "Withdraw"

/** The primary type of Hyperliquid's CCTP send, which Main's withdrawal into a venue may be instead of a `withdraw3`. */
const HYPERLIQUID_CCTP_TYPE = "HyperliquidTransaction:SendToEvmWithData"

/** The chain Main signs its Bybit deposit address on, so the one chain a CCTP send into it may pay on. */
const CCTP_DEPOSIT_CHAIN_ID = ChainId.ARBITRUM

/**
 * The venues a LaMarge take may deliver into straight, to Main's deposit address there, as Main signed it: those LaMarge
 * reaches only on chain.
 */
const TAKE_DEPOSIT_VENUES: ReadonlySet<VenueId> = new Set([VenueId.BYBIT])

/**
 * The key a Lighter transfer's owner message names, as the signer's `LIGHTER_TRANSFER_MESSAGE` leaves it unread: its
 * index, in hex, which must be one of lebroker's on Main.
 */
const LIGHTER_TRANSFER_API_KEY = /\napi key: 0x([0-9a-f]{16})\n/

/** Lighter's USDC amounts, in millionths. */
const LIGHTER_USDC_DECIMALS = 6

export {
  ASTER_AGENT_TERMS,
  ASTER_APPROVAL_FIELDS,
  ASTER_TRANSFER_FIELDS,
  BPS,
  CLOCK_SLACK_MS,
  DEPOSIT_WITHDRAWAL_ACTIONS,
  CCTP_DEPOSIT_ACTIONS,
  CCTP_DEPOSIT_CHAIN_ID,
  HYPERLIQUID_CCTP_TYPE,
  LIGHTER_FAST_ACTIONS,
  POLYMARKET_BRIDGE_ACTIONS,
  POLYMARKET_BRIDGE_MIN_UNITS,
  POLYMARKET_PERPS_WITHDRAW_TYPE,
  LIGHTER_FAST_MIN_UNITS,
  EIP712_DOMAIN_FIELDS,
  OP_INTERNAL_TRANSFER,
  OP_TYPE,
  HYPERLIQUID_MAINNET,
  LAMARGE_DEPLOYMENTS,
  LAMARGE_PERMIT_SECONDS,
  LIGHTER_TRANSFER_API_KEY,
  LIGHTER_USDC_DECIMALS,
  SIGNATURE_CHAIN_IDS,
  TAKE_DEPOSIT_VENUES,
  USDC,
}
