import { describe, expect, test } from "bun:test"
import type { Attested } from "@lamarge/sdk/attestation"
import {
  CHAINS,
  COLLATERAL_ROUTE,
  ENVIRONMENT_SLOTS,
  ESCROW,
  TAKER_API_KEY,
  UNLIMITED_ALLOWANCE,
  USDC_ASSET,
  decimalsOf,
  fillMemo,
  fromHex,
  opHash,
  schemas,
  transferMessage,
} from "@lamarge/sdk/protocol"
import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem"
import {
  LIGHTER_KEY_INDEX,
  SignaturePayloadKind,
  SignatureRequestKind,
  SignatureRequestReason,
  type LaMargeRequestContext,
  type LaMargeSend,
  type LaMargeTake,
} from "../lebroker/accounts/model"
import { Network, VenueId, shortAddress } from "../lebroker/core/model"
import { MAIN_LIGHTER_ACCOUNT_PROOF_TYPES, SUB_ACCOUNT_PROOF_DOMAIN } from "../lebroker/signer/model"
import {
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_CHAIN_IDS,
  ASTER_SIGN_DOMAIN,
  AsterAgentKind,
  HYPERLIQUID_SEND_DEX,
  HYPERLIQUID_USDC,
  polymarketDeleteProxyOp,
  polymarketOpTypedData,
  polymarketDepositWalletBatchTypedData,
  POLYMARKET_PERPS_WITHDRAW_DOMAIN,
  POLYMARKET_PERPS_WITHDRAW_TYPES,
  polymarketDepositWalletOf,
} from "../lebroker/venues/model"
import {
  asterAgentApprovalRequest,
  hyperliquidApproveAgentRequest,
  hyperliquidSendAssetRequest,
  hyperliquidCctpSendRequest,
  hyperliquidWithdrawRequest,
  polymarketCreateProxyTypedData,
} from "./testing/builders/builders"
import { SignableRefusal, SignStarter, SignSummaryLabel, SignSummaryText } from "./enums"
import { signableRequest } from "./signableRequest"
import {
  AGENT,
  ASKED_AT,
  ASTER_AGENT_NAME,
  CLOSED_SHARED_SUB,
  CLOSED_SUB,
  HYPERLIQUID_AGENT_NAME,
  LAMARGE_PRODUCTION,
  MAIN,
  MAIN_ACCOUNT_ID,
  SHARED_SUB,
  STRANGER,
  SUB,
  USER_ID,
  registrationMessage,
  requestOf,
} from "./testing/fixtures"
import type { TransferToProps } from "./testing/types"

const DAY_MS = 24 * 60 * 60 * 1000

/** LaMarge's dev deployment, as the executor names it in a request. */
const LAMARGE_DEV = { appOrigin: "https://app.dev.lamarge.trade" }

/** LaMarge dev's own escrow on HyperEVM, which LaMarge's SDK reviews as it does production's. */
const DEVELOPMENT_ESCROW = "0x948E65c40442d935d4ee990BDbD01BdD825c4873"

/** LaMarge dev's own escrow on Arbitrum, which LaMarge's SDK pins under GMX's name. */
const ARBITRUM_ESCROW = "0x66e4c25d7e92c3e2765b021a748e740f775ac112"

function refusalOf(props: ReturnType<typeof requestOf>): string | null {
  const read = signableRequest(props)
  return read.ok ? null : read.refusal
}

function hyperliquidApproval({
  signatureChainId = 42161,
  validDays = 180,
  name = HYPERLIQUID_AGENT_NAME,
}: { signatureChainId?: number; validDays?: number; name?: string } = {}) {
  return hyperliquidApproveAgentRequest({
    agentAddress: AGENT,
    name,
    validUntil: ASKED_AT + validDays * DAY_MS,
    nonce: ASKED_AT,
    network: Network.MAINNET,
    signatureChainId,
  }).typedData
}

function asterApproval({
  kind = AsterAgentKind.TRADING,
  agentName = ASTER_AGENT_NAME,
}: { kind?: AsterAgentKind; agentName?: string } = {}) {
  return asterAgentApprovalRequest({
    kind,
    user: MAIN,
    agent: AGENT,
    nonce: String(ASKED_AT * 1000),
    expiry: ASKED_AT + 180 * DAY_MS,
    now: ASKED_AT,
    agentName,
  }).typedData
}

function asterMessage({ msg, chainId }: { msg: string; chainId: number }) {
  return { domain: { ...ASTER_SIGN_DOMAIN, chainId }, types: ASTER_MESSAGE_TYPES, primaryType: "Message", message: { msg } }
}

function asterTransfer({ to, user = MAIN }: { to: string; user?: string }) {
  const msg = new URLSearchParams([
    ["asset", "USDT"],
    ["amount", "12.5"],
    ["toAddress", to],
    ["clientTranId", "move-1"],
    ["nonce", String(ASKED_AT * 1000)],
    ["user", user],
  ]).toString()
  return asterMessage({ msg, chainId: ASTER_SIGN_CHAIN_IDS[Network.MAINNET] })
}

// A LaMarge take paid inside Aster, as dev asked Main to sign it on 19 October 2026 at 20:27 UTC: the transfer pays the
// maker's Aster account, under the fill's id with its dashes left out, from Main.
const TAKE_MAIN = "0x6e20eB5e456E65BcE071cF42228c10EC5018fd53"
const TAKE_MAKER = "0x651f38C5fC75C9Dd3FD4663011D17514dEF55C09"
const TAKE_FILL_ID = "01a155d9-0319-7226-b6c3-b6e3fa577c93"
const TAKE_MESSAGE = `asset=USDT&amount=62.13&toAddress=${TAKE_MAKER}&clientTranId=01a155d903197226b6c3b6e3fa577c93&nonce=1792441703543980&user=${TAKE_MAIN}`
/** When dev asked for it: 53.5 s before the transfer's nonce, which LaMarge sets 20 to 70 s ahead. */
const TAKE_ASKED_AT = Date.UTC(2026, 9, 19, 20, 27, 30)

/** The take as LaMarge's API answered it: one fill from Main's Aster to its Hyperliquid, 62.13 USDT to the maker. */
function asterTake({ fill = {} }: { fill?: Partial<LaMargeTake["fills"][number]> } = {}): LaMargeTake {
  return {
    input: { from: "aster", to: "hyperliquid", amount_in: "62130000000000000000", min_out: "62000000" },
    fills: [
      {
        id: TAKE_FILL_ID,
        order_id: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        sequence: 3,
        role: "taker",
        from_venue: "aster",
        to_venue: "hyperliquid",
        amount_in: "62130000000000000000",
        amount_out: "62050000",
        payer: TAKE_MAIN,
        maker_recipient: TAKE_MAKER,
        taker_recipient: TAKE_MAIN,
        swap_id: "0x00000000000000000000000000000000000000000000000000000000000000bb",
        hashlock: "0x00000000000000000000000000000000000000000000000000000000000000cc",
        pay_by: new Date(TAKE_ASKED_AT + 60_000).toISOString(),
        t1: new Date(TAKE_ASKED_AT + 120_000).toISOString(),
        t2: new Date(TAKE_ASKED_AT + 600_000).toISOString(),
        delivery_to: null,
        taker_fee: "0",
        ...fill,
      },
    ],
  }
}

/** The take's transfer as dev sent it, its nonce `ms` after dev asked for it. */
function takeMessageAt({ ms }: { ms: number }): string {
  return TAKE_MESSAGE.replace(/nonce=\d+/, `nonce=${(TAKE_ASKED_AT + ms) * 1000}`)
}

/** A LaMarge move's request for the take's payment inside Aster, as dev sent it, with `msg` in place of its message. */
function asterTakeRequest({
  msg = TAKE_MESSAGE,
  take = asterTake(),
  kind = SignatureRequestKind.LAMARGE_MOVE,
  reason = SignatureRequestReason.MOVE,
}: { msg?: string; take?: LaMargeTake | null; kind?: SignatureRequestKind; reason?: SignatureRequestReason } = {}) {
  return requestOf({
    kind,
    venue: kind === SignatureRequestKind.TRANSFER ? VenueId.ASTER : null,
    typedData: asterMessage({ msg, chainId: ASTER_SIGN_CHAIN_IDS[Network.MAINNET] }),
    ...(take === null ? {} : { take }),
    reason,
    askedAt: TAKE_ASKED_AT,
    main: TAKE_MAIN,
  })
}

// A LaMarge take paid inside Lighter, as LaMarge's web test of paying from Lighter writes it (`lighter-pay.test.ts`): its
// owner's address, and the owner message for the transfer from its account 42 to the maker's 731033, 2.0013 USDC under
// the fill's id, at nonce 7, with no fee.
const LIGHTER_MAIN = "0x7564105E977516C53bE337314c7E53838967bDaC"
const LIGHTER_FILL_ID = "018f8d98-f485-7f48-9630-e0b7368fe28f"
const LIGHTER_TAKE_MESSAGE =
  "Transfer\n\nnonce: 0x0000000000000007\nfrom: 0x000000000000002a (route 0x0000000000000000)\napi key: 0x00000000000000fe\nto: 0x00000000000b2799 (route 0x0000000000000000)\nasset: 0x0000000000000003\namount: 0x00000000001e8994\nfee: 0x0000000000000000\nchainId: 0x0000000000000130\nmemo: 018f8d98f4857f489630e0b7368fe28f00000000000000000000000000000000\nOnly sign this message for a trusted client!"

/** Lighter's owner message for a take's transfer, as LaMarge's SDK writes it: the one above unless said. */
function lighterTransferText({
  to = 731_033,
  amount = 2_001_300n,
  fee = 0n,
  apiKey = TAKER_API_KEY,
  asset = USDC_ASSET,
  fromRoute = COLLATERAL_ROUTE,
  chainId,
  fill = LIGHTER_FILL_ID,
}: {
  to?: number
  amount?: bigint
  fee?: bigint
  apiKey?: number
  asset?: number
  fromRoute?: number
  chainId?: number
  fill?: string
} = {}): string {
  const transfer = {
    from: 42,
    apiKey,
    to,
    asset,
    fromRoute,
    toRoute: COLLATERAL_ROUTE,
    amount,
    fee,
    memo: fromHex(fillMemo(fill)),
    expiredAt: 0,
    nonce: 7,
  }
  return chainId === undefined ? transferMessage(transfer) : transferMessage(transfer, chainId)
}

/** The take as LaMarge's API answered it, the accounts beside it as Lighter answered the executor: one fill to Hyperliquid. */
function lighterTake({
  fill = {},
  lighter = { from_account_index: 42, to_account_index: 731_033 },
}: { fill?: Partial<LaMargeTake["fills"][number]>; lighter?: LaMargeTake["lighter"] | null } = {}): LaMargeTake {
  return {
    input: { from: "lighter", to: "hyperliquid", amount_in: "2001300", min_out: "2000000" },
    fills: [
      {
        id: LIGHTER_FILL_ID,
        order_id: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        sequence: 4,
        role: "taker",
        from_venue: "lighter",
        to_venue: "hyperliquid",
        amount_in: "2001300",
        amount_out: "2000500",
        payer: LIGHTER_MAIN,
        maker_recipient: TAKE_MAKER,
        taker_recipient: LIGHTER_MAIN,
        swap_id: "0x00000000000000000000000000000000000000000000000000000000000000bb",
        hashlock: "0x00000000000000000000000000000000000000000000000000000000000000cc",
        pay_by: new Date(ASKED_AT + 60_000).toISOString(),
        t1: new Date(ASKED_AT + 120_000).toISOString(),
        t2: new Date(ASKED_AT + 600_000).toISOString(),
        delivery_to: null,
        taker_fee: "0",
        ...fill,
      },
    ],
    ...(lighter === null ? {} : { lighter }),
  }
}

/** A LaMarge move's request for the take's payment inside Lighter: Lighter's owner message, and the take beside it. */
function lighterTakeRequest({
  message = LIGHTER_TAKE_MESSAGE,
  take = lighterTake(),
  kind = SignatureRequestKind.LAMARGE_MOVE,
  reason = SignatureRequestReason.MOVE,
  lamarge,
}: {
  message?: string
  take?: LaMargeTake | null
  kind?: SignatureRequestKind
  reason?: SignatureRequestReason
  lamarge?: LaMargeRequestContext
} = {}) {
  return requestOf({
    kind,
    venue: kind === SignatureRequestKind.LAMARGE_MOVE ? null : VenueId.LIGHTER,
    message,
    ...(take === null ? {} : { take }),
    ...(lamarge === undefined ? {} : { lamarge }),
    reason,
    main: LIGHTER_MAIN,
  })
}

function sendAsset({
  destination,
  signatureChainId = 42161,
  sourceDex = HYPERLIQUID_SEND_DEX,
  destinationDex = HYPERLIQUID_SEND_DEX,
}: {
  destination: Address
  signatureChainId?: number
  sourceDex?: string
  destinationDex?: string
}) {
  return hyperliquidSendAssetRequest({
    destination,
    sourceDex,
    destinationDex,
    token: HYPERLIQUID_USDC,
    amount: 25,
    nonce: ASKED_AT,
    network: Network.MAINNET,
    signatureChainId,
  }).typedData
}

function lighterProof({ owner = USER_ID, account = MAIN_ACCOUNT_ID }: { owner?: string; account?: string } = {}) {
  return {
    domain: SUB_ACCOUNT_PROOF_DOMAIN,
    types: MAIN_LIGHTER_ACCOUNT_PROOF_TYPES,
    primaryType: "MainLighterAccount",
    message: { owner, account, main: MAIN, accountIndex: 42n, nonce: 9n, deadline: BigInt(ASKED_AT / 1000 + 600) },
  }
}

/**
 * One payment of a take from Main's Hyperliquid, its maker a stranger, delivered on `to` (on the chain `receiveChainId`
 * names, `to`'s unless said) in `receiveToken` from `receiveEscrow` (that venue's own by default) to `receiveRecipient`:
 * by default, as lebroker's recorded take into Aster paid it, 60 USDC for 60 USDT, each at its own decimals.
 */
function lockPayment({
  to = "aster",
  receiveChainId = String(CHAINS[to]?.id),
  receiveToken = CHAINS[to]?.token,
  receiveEscrow = CHAINS[to]?.escrow,
  receiveRecipient = MAIN,
  amount = "60000000",
  amountOut = "60000000000000000000",
}: {
  to?: string
  receiveChainId?: string
  receiveToken?: string | undefined
  receiveEscrow?: string
  receiveRecipient?: string
  amount?: string
  amountOut?: string
} = {}) {
  return {
    payer: MAIN,
    swapId: `0x${"03".repeat(32)}`,
    recipient: STRANGER,
    amount,
    hashlock: `0x${"07".repeat(32)}`,
    refundAt: String(ASKED_AT / 1000 + 7_200),
    deadline: String(ASKED_AT / 1000 + 45),
    orderId: `0x${"0a".repeat(32)}`,
    sequence: "1",
    amountOut,
    receiveChainId,
    receiveToken,
    receiveEscrow,
    receiveRecipient,
    dex: "0",
  }
}

/**
 * A take's payment from Main's Hyperliquid into `escrow`, as LaMarge asks it: by default one payment of 60 USDC,
 * delivered into `into` from `receiveEscrow`, on the chain `receiveChainId` names (`into`'s unless said), for as much at
 * `into`'s decimals.
 */
function payTake({
  escrow = ESCROW,
  into = "hyperliquid",
  receiveChainId = String(CHAINS[into]?.id),
  receiveEscrow = ESCROW,
  payments = [lockPayment({ to: into, receiveChainId, receiveEscrow, amountOut: String(60n * 10n ** BigInt(decimalsOf(into))) })],
}: {
  escrow?: string
  into?: string
  receiveChainId?: string
  receiveEscrow?: string
  payments?: ReturnType<typeof lockPayment>[]
} = {}) {
  return {
    domain: { name: "LaMarge", version: "1", chainId: CHAINS.hyperliquid?.id, verifyingContract: escrow },
    types: schemas.PayTake,
    primaryType: "PayTake",
    message: { payer: MAIN, deposit: "60000000", payments },
  }
}

function permit({ spender = ESCROW }: { spender?: string } = {}) {
  const chain = CHAINS.hyperliquid
  return {
    domain: { name: chain?.permit, version: chain?.version, chainId: chain?.id, verifyingContract: chain?.token },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner: MAIN, spender, value: UNLIMITED_ALLOWANCE, nonce: 0n, deadline: BigInt(ASKED_AT / 1000 + 300) },
  }
}

function signIn({ host }: { host: string }): string {
  const issued = new Date(ASKED_AT).toISOString()
  const expires = new Date(ASKED_AT + 5 * 60 * 1000).toISOString()
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    MAIN,
    "",
    "Sign in to LaMarge.",
    "",
    `URI: https://${host}`,
    "Version: 1",
    "Chain ID: 1",
    "Nonce: abc123",
    `Issued At: ${issued}`,
    `Expiration Time: ${expires}`,
  ].join("\n")
}

describe("a venue's setup", () => {
  test("refuses another agent's name, an approval past 180 days, and a domain with a field more", () => {
    const renamed = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() })
    if (renamed.request.payload.kind === "typed-data") {
      renamed.request.payload.typedData.message.agentName = "attacker valid_until 1"
    }
    expect(refusalOf(renamed)).toBe(SignableRefusal.NOT_LEBROKER_AGENT)
    // Another deployment's name, production's here: approving it would replace that deployment's agent on Main.
    expect(refusalOf(requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval({ name: "lebroker" }) }))).toBe(
      SignableRefusal.NOT_LEBROKER_AGENT,
    )
    const long = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() })
    if (long.request.payload.kind === "typed-data") {
      long.request.payload.typedData.message.agentName = `${HYPERLIQUID_AGENT_NAME} valid_until ${ASKED_AT + 365 * DAY_MS}`
    }
    expect(refusalOf(long)).toBe(SignableRefusal.TOO_LONG)
    const salted = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() })
    if (salted.request.payload.kind === "typed-data") {
      salted.request.payload.typedData.domain.salt = "0x01"
    }
    expect(refusalOf(salted)).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("signs Aster's trading agent, perps only, never one that withdraws, never for another wallet", () => {
    const approved = signableRequest(requestOf({ venue: VenueId.ASTER, typedData: asterApproval() }))
    expect(approved.ok && approved.summary.action).toBe(SignSummaryText.APPROVE_ASTER_AGENT)
    const typed = asterApproval()
    const spot = { ...typed, message: { msg: typed.message.msg.replace("canSpotTrade=false", "canSpotTrade=true") } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: spot }))).toBe(SignableRefusal.OTHER_PERMISSIONS)
    const withdrawing = { ...typed, message: { msg: typed.message.msg.replace("canWithdraw=false", "canWithdraw=true") } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: withdrawing }))).toBe(SignableRefusal.WITHDRAW_PERMISSION)
    const other = { ...typed, message: { msg: typed.message.msg.replace(`user=${MAIN}`, `user=${STRANGER}`) } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: other }))).toBe(SignableRefusal.OTHER_MAIN)
    // Another agent's name, which Aster would replace with this one.
    const named = { ...typed, message: { msg: typed.message.msg.replace("agentName=leneutre-dev&", "agentName=LaMarge&") } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: named }))).toBe(SignableRefusal.NOT_LEBROKER_AGENT)
  })

  test("signs Aster's agents under this deployment's names only, never another deployment's on the same Main", () => {
    // Production's names, asked of development's front: approving them would replace production's agents.
    for (const kind of [AsterAgentKind.TRADING, AsterAgentKind.CONVERT]) {
      const production = asterApproval({ kind, agentName: "leneutre" })
      expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: production }))).toBe(SignableRefusal.NOT_LEBROKER_AGENT)
    }
    const converter = asterApproval({ kind: AsterAgentKind.CONVERT })
    expect(new URLSearchParams(converter.message.msg).get("agentName")).toBe("leneutre-dev-convert")
    expect(signableRequest(requestOf({ venue: VenueId.ASTER, typedData: converter })).ok).toBe(true)
  })

  test("signs Aster's conversion agent, Spot only, in its own words, never one that trades perps or withdraws", () => {
    const typed = asterApproval({ kind: AsterAgentKind.CONVERT })
    const approved = signableRequest(requestOf({ venue: VenueId.ASTER, typedData: typed }))
    expect(approved.ok && approved.summary.action).toBe(SignSummaryText.APPROVE_ASTER_CONVERT_AGENT)
    expect(String(SignSummaryText.APPROVE_ASTER_CONVERT_AGENT)).toBe(
      "Let leneutre convert USDC to USDT on Aster's Spot market for Main: no perps trading, no withdrawal",
    )
    for (const [from, to, refusal] of [
      ["canPerpTrade=false", "canPerpTrade=true", SignableRefusal.OTHER_PERMISSIONS],
      ["canSpotTrade=true", "canSpotTrade=false", SignableRefusal.OTHER_PERMISSIONS],
      ["canWithdraw=false", "canWithdraw=true", SignableRefusal.WITHDRAW_PERMISSION],
      [`user=${MAIN}`, `user=${STRANGER}`, SignableRefusal.OTHER_MAIN],
    ] as const) {
      const changed = { ...typed, message: { msg: typed.message.msg.replace(from, to) } }
      expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: changed }))).toBe(refusal)
    }
  })

  test("signs Polymarket's proxy for a week, not a month", () => {
    const week = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT + 7 * DAY_MS, salt: 1, ts: ASKED_AT })
    expect(signableRequest(requestOf({ venue: VenueId.POLYMARKET_PERPS, typedData: week })).ok).toBe(true)
    const month = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT + 30 * DAY_MS, salt: 1, ts: ASKED_AT })
    expect(refusalOf(requestOf({ venue: VenueId.POLYMARKET_PERPS, typedData: month }))).toBe(SignableRefusal.TOO_LONG)
  })

  test("signs Polymarket's deletion of the proxy the request names only, never Main's, never another operation", () => {
    const deletion = polymarketOpTypedData({ op: polymarketDeleteProxyOp({ proxy: AGENT }), salt: 1, ts: ASKED_AT })
    const deletes = { venue: VenueId.POLYMARKET_PERPS, key: AGENT }
    const kind = SignatureRequestKind.VENUE_RENEWAL
    const read = signableRequest(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: deletion, deletes }))
    expect(read.ok && read.summary.action).toBe(SignSummaryText.DELETE_POLYMARKET_PROXY)
    // The hash alone is signed: without the proxy it deletes, or naming another, it can't be checked.
    expect(refusalOf(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: deletion }))).toBe(SignableRefusal.NO_DELETED_PROXY)
    const other = { venue: VenueId.POLYMARKET_PERPS, key: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }
    expect(refusalOf(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: deletion, deletes: other }))).toBe(
      SignableRefusal.OTHER_DELETION,
    )
    const ofMain = polymarketOpTypedData({ op: polymarketDeleteProxyOp({ proxy: MAIN }), salt: 1, ts: ASKED_AT })
    const mainDeleted = { venue: VenueId.POLYMARKET_PERPS, key: MAIN }
    expect(refusalOf(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: ofMain, deletes: mainDeleted }))).toBe(
      SignableRefusal.UNKNOWN_SHAPE,
    )
  })

  test("says where a renewal's signature stands among its chain's, before what it does, and refuses a place past the last", () => {
    const deletion = polymarketOpTypedData({ op: polymarketDeleteProxyOp({ proxy: AGENT }), salt: 1, ts: ASKED_AT })
    const deletes = { venue: VenueId.POLYMARKET_PERPS, key: AGENT }
    const kind = SignatureRequestKind.VENUE_RENEWAL
    const second = signableRequest(
      requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: deletion, deletes, step: { index: 2, total: 8 } }),
    )
    expect(second.ok && second.summary.action).toBe(`Step 2 of 8: ${SignSummaryText.DELETE_POLYMARKET_PROXY}`)
    // The approval keeps its words, with its place: the chain's last.
    const approval = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT + 7 * DAY_MS, salt: 1, ts: ASKED_AT })
    const last = signableRequest(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: approval, step: { index: 8, total: 8 } }))
    expect(last.ok && last.summary.action).toBe(`Step 8 of 8: ${SignSummaryText.APPROVE_POLYMARKET_PROXY}`)
    expect(
      refusalOf(requestOf({ kind, venue: VenueId.POLYMARKET_PERPS, typedData: deletion, deletes, step: { index: 9, total: 8 } })),
    ).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("signs Lighter's proof for Main's own account, and its key's registration at leneutre's indexes only, 200 to 252", () => {
    expect(signableRequest(requestOf({ venue: VenueId.LIGHTER, typedData: lighterProof() })).ok).toBe(true)
    expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, typedData: lighterProof({ owner: "user-2" }) }))).toBe(SignableRefusal.OTHER_MAIN)
    expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, typedData: lighterProof({ account: "account-sub-1" }) }))).toBe(
      SignableRefusal.OTHER_ACCOUNT,
    )
    const ours = registrationMessage({ accountIndex: 42, apiKeyIndex: LIGHTER_KEY_INDEX })
    expect(signableRequest(requestOf({ venue: VenueId.LIGHTER, message: ours })).ok).toBe(true)
    // Past another's key at 200, as a self-hosted executor's: the index lebroker chose is shown as it is.
    const next = signableRequest(
      requestOf({ venue: VenueId.LIGHTER, message: registrationMessage({ accountIndex: 42, apiKeyIndex: 201 }) }),
    )
    expect(next.ok ? next.summary.lines : null).toContainEqual({ label: SignSummaryLabel.KEY_INDEX, value: "201" })
    expect(
      signableRequest(requestOf({ venue: VenueId.LIGHTER, message: registrationMessage({ accountIndex: 42, apiKeyIndex: 252 }) })).ok,
    ).toBe(true)
    // LaMarge's indexes, production's and development's, never lebroker's: a setup there would replace LaMarge's key.
    for (const slots of [ENVIRONMENT_SLOTS.production, ENVIRONMENT_SLOTS.development]) {
      const lamarge = registrationMessage({ accountIndex: 42, apiKeyIndex: slots.lighterKeyIndex })
      expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, message: lamarge }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
    }
    const theirs = registrationMessage({ accountIndex: 42, apiKeyIndex: 3 })
    expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, message: theirs }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
    const below = registrationMessage({ accountIndex: 42, apiKeyIndex: 199 })
    expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, message: below }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
  })

  test("refuses a permit, or anything, asked as a venue's setup", () => {
    expect(refusalOf(requestOf({ venue: VenueId.HYPERLIQUID, typedData: permit() }))).not.toBeNull()
    expect(refusalOf(requestOf({ venue: VenueId.HYPERLIQUID, message: "Sign anything" }))).toBe(SignableRefusal.UNKNOWN_VENUE)
  })
})

describe("a transfer from Main", () => {
  test("sends to one of the user's own open sub-accounts, and names it", () => {
    const read = signableRequest(
      requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: sendAsset({ destination: SUB }) }),
    )
    expect(read.ok && read.summary.lines.map(line => line.value)).toEqual(["25 USDC", "Sub-account 1 (0x2222…2222)", "42161"])
    expect(
      signableRequest(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.ASTER, typedData: asterTransfer({ to: SUB }) })).ok,
    ).toBe(true)
  })

  test("sends between the balances each account's mode keeps its collateral in, spot or the main dex's perps, and no other", () => {
    for (const dexes of [
      { sourceDex: "spot", destinationDex: "" },
      { sourceDex: "", destinationDex: "spot" },
      { sourceDex: "", destinationDex: "" },
    ]) {
      const typedData = sendAsset({ destination: SUB, ...dexes })
      expect(signableRequest(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData })).ok).toBe(true)
    }
    const hip3 = sendAsset({ destination: SUB, destinationDex: "xyz" })
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: hip3 }))).toBe(
      SignableRefusal.UNKNOWN_SHAPE,
    )
  })

  test("sends to an open sub-account another user shares with the user, as the service lists it, named with its owner", () => {
    const read = signableRequest(
      requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: sendAsset({ destination: SHARED_SUB }) }),
    )
    expect(read.ok && read.summary.lines.map(line => line.value)).toEqual(["25 USDC", "Hedges of 0x8888…8888 (0x7777…7777)", "42161"])
    const aster = requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.ASTER, typedData: asterTransfer({ to: SHARED_SUB }) })
    expect(signableRequest(aster).ok).toBe(true)
    // One shared but closed, or none shared with the user: refused as a stranger.
    const closed = requestOf({
      kind: SignatureRequestKind.TRANSFER,
      venue: VenueId.HYPERLIQUID,
      typedData: sendAsset({ destination: CLOSED_SHARED_SUB }),
    })
    expect(refusalOf(closed)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    const none = requestOf({
      kind: SignatureRequestKind.TRANSFER,
      venue: VenueId.HYPERLIQUID,
      typedData: sendAsset({ destination: SHARED_SUB }),
      shared: [],
    })
    expect(refusalOf(none)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
  })

  test("refuses a destination that isn't one of the user's open sub-accounts", () => {
    for (const destination of [STRANGER, CLOSED_SUB, MAIN]) {
      const props = requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: sendAsset({ destination }) })
      expect(refusalOf(props)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
    const aster = requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.ASTER, typedData: asterTransfer({ to: STRANGER }) })
    expect(refusalOf(aster)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
  })

  test("refuses another action than the transfer: a withdrawal, a message, Polymarket's hashed command", () => {
    const withdraw = hyperliquidWithdrawRequest({
      destination: SUB,
      amount: 25,
      time: ASKED_AT,
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: withdraw }))).toBe(
      SignableRefusal.UNKNOWN_SHAPE,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, message: "hello" }))).toBe(
      SignableRefusal.OPAQUE,
    )
    const op = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT, salt: 1, ts: ASKED_AT })
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.POLYMARKET_PERPS, typedData: op }))).toBe(
      SignableRefusal.OPAQUE,
    )
  })
})

/** Main's Lighter transfer to its sub-account, as Lighter writes its owner message: from Main's account 42 to 731. */
function mainLighterTransferText({
  to = 731,
  apiKey = 201,
  fee = 0n,
  fromRoute = COLLATERAL_ROUTE,
}: { to?: number; apiKey?: number; fee?: bigint; fromRoute?: number } = {}): string {
  return transferMessage({
    from: 42,
    apiKey,
    to,
    asset: USDC_ASSET,
    fromRoute,
    toRoute: COLLATERAL_ROUTE,
    amount: 95_310_000n,
    fee,
    memo: fromHex(`${"ab".repeat(32)}`),
    expiredAt: 0,
    nonce: 3,
  })
}

/**
 * Its request, and the owner of each account as the browser read it from Lighter: Main's at 42, the sub-account's at
 * 731; null, unread.
 */
function mainLighterTransfer({
  message = mainLighterTransferText(),
  lighterAccounts = new Map([
    [42, MAIN],
    [731, SUB],
  ]),
}: { message?: string; lighterAccounts?: ReadonlyMap<number, string> | null } = {}) {
  return {
    ...requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.LIGHTER, message }),
    ...(lighterAccounts === null ? {} : { lighterAccounts }),
  }
}

describe("Main's Lighter transfer to its own sub-account, by its transfer key", () => {
  test("sends from Main's own account to the user's open sub-account, as Lighter read them, and says what it pays", () => {
    const read = signableRequest(mainLighterTransfer())
    expect(read.ok && read.summary).toEqual({
      action: SignSummaryText.TRANSFER,
      lines: [
        { label: SignSummaryLabel.AMOUNT, value: "95.31 USDC" },
        { label: SignSummaryLabel.LIGHTER_FEE, value: "0 USDC" },
        { label: SignSummaryLabel.TO, value: "Sub-account 1 (0x2222…2222)" },
      ],
      chainId: null,
    })
  })

  test("refuses without Lighter's own read of its accounts, from another account than Main's, or to one not the user's", () => {
    expect(refusalOf(mainLighterTransfer({ lighterAccounts: null }))).toBe(SignableRefusal.LIGHTER_ACCOUNTS_UNREAD)
    expect(refusalOf(mainLighterTransfer({ lighterAccounts: new Map([[42, MAIN]]) }))).toBe(SignableRefusal.LIGHTER_ACCOUNTS_UNREAD)
    const notMain = new Map([
      [42, STRANGER],
      [731, SUB],
    ])
    expect(refusalOf(mainLighterTransfer({ lighterAccounts: notMain }))).toBe(SignableRefusal.NOT_FROM_MAIN_LIGHTER)
    for (const owner of [STRANGER, CLOSED_SUB, MAIN]) {
      const to = new Map([
        [42, MAIN],
        [731, owner],
      ])
      expect(refusalOf(mainLighterTransfer({ lighterAccounts: to }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
  })

  test("refuses a key that isn't lebroker's on Main, a fee over Lighter's, and any message Lighter wouldn't write so", () => {
    expect(refusalOf(mainLighterTransfer({ message: mainLighterTransferText({ apiKey: 254 }) }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
    expect(refusalOf(mainLighterTransfer({ message: mainLighterTransferText({ fee: 3_000_000n }) }))).toBe(SignableRefusal.FEE_OVER_CAP)
    expect(refusalOf(mainLighterTransfer({ message: mainLighterTransferText({ fromRoute: 1 }) }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(mainLighterTransfer({ message: `${mainLighterTransferText()} ` }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("signs the proof of Main's account and the key's registration its first transfer asks", () => {
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.LIGHTER, typedData: lighterProof() })).ok).toBe(
      true,
    )
    const registration = registrationMessage({ accountIndex: 42, apiKeyIndex: 201 })
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.LIGHTER, message: registration })).ok).toBe(true)
    // At LaMarge's index, never lebroker's: refused as at a setup.
    const lamarge = registrationMessage({ accountIndex: 42, apiKeyIndex: 254 })
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.LIGHTER, message: lamarge }))).toBe(
      SignableRefusal.NOT_LEBROKER_KEY,
    )
  })
})

describe("Main's Lighter fast withdrawal straight into its own Bybit, by the deposit address Main signed", () => {
  /** Main's Bybit deposit address on Arbitrum, as the browser took it once Main's signature of it recovered Main. */
  const BYBIT_DEPOSIT = "0x52c336060d171d2f27baa3d1d3b156fb4a79289c"
  const MEMO = `${BYBIT_DEPOSIT.slice(2)}${"00".repeat(12)}`

  function fastText({ to = 675_395, amount = 4_000_000n, memo = MEMO }: { to?: number; amount?: bigint; memo?: string } = {}) {
    return transferMessage({
      from: 42,
      apiKey: 201,
      to,
      asset: USDC_ASSET,
      fromRoute: COLLATERAL_ROUTE,
      toRoute: COLLATERAL_ROUTE,
      amount,
      fee: 0n,
      memo: fromHex(memo),
      expiredAt: 0,
      nonce: 3,
    })
  }

  /** Its request, Lighter's owners of the accounts it names as the browser read them, and the deposit address read. */
  function fast({
    message = fastText(),
    depositVenue = VenueId.BYBIT,
    depositAddress = { venue: VenueId.BYBIT, address: BYBIT_DEPOSIT },
    from = MAIN,
  }: {
    message?: string
    depositVenue?: VenueId | null
    depositAddress?: { venue: VenueId; address: string } | null
    from?: string
  } = {}) {
    return {
      ...requestOf({
        kind: SignatureRequestKind.WITHDRAWAL,
        venue: VenueId.LIGHTER,
        message,
        depositVenue,
        ...(depositAddress === null ? {} : { depositAddress }),
      }),
      lighterAccounts: new Map([
        [42, from],
        [675_395, STRANGER],
      ]),
    }
  }

  test("signs a transfer from Main's own Lighter account to the pinned pool, its memo the address Main signed", () => {
    const read = signableRequest(fast())
    if (!read.ok) {
      throw new Error(read.refusal)
    }
    expect(read.summary.action).toBe(SignSummaryText.LIGHTER_FAST_INTO_BYBIT)
    expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.LIGHTER_POOL, value: "675395" })
    expect(read.summary.chainId).toBeNull()
  })

  test("refuses another pool, another memo, the request's address alone, another venue, another account than Main's", () => {
    expect(refusalOf(fast({ message: fastText({ to: 731 }) }))).toBe(SignableRefusal.NOT_FAST_WITHDRAW_POOL)
    expect(refusalOf(fast({ message: fastText({ memo: `${STRANGER.slice(2).toLowerCase()}${"00".repeat(12)}` }) }))).toBe(
      SignableRefusal.NOT_DEPOSIT_ADDRESS,
    )
    expect(refusalOf(fast({ depositAddress: null }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    expect(refusalOf(fast({ depositVenue: VenueId.LIGHTER, depositAddress: { venue: VenueId.LIGHTER, address: BYBIT_DEPOSIT } }))).toBe(
      SignableRefusal.DEPOSIT_VENUE,
    )
    expect(refusalOf(fast({ from: STRANGER }))).toBe(SignableRefusal.NOT_FROM_MAIN_LIGHTER)
    expect(refusalOf(fast({ message: fastText({ amount: 3_999_999n }) }))).toBe(SignableRefusal.DEPOSIT_TOO_SMALL)
    // A Lighter owner message naming no venue isn't a withdrawal Main signs.
    expect(refusalOf(fast({ depositVenue: null }))).toBe(SignableRefusal.OPAQUE)
  })
})

describe("Main's Polymarket bridge withdrawal straight into its own Bybit, from its Deposit Wallet", () => {
  const BYBIT_DEPOSIT = "0x52c336060d171d2f27baa3d1d3b156fb4a79289c"
  /** The bridge's address for Main's wallet and that recipient, as the browser asked the bridge for it. */
  const PAY_TO: Address = "0x23C39b368a0480C3bfb8AA49960a0DdB26865953"
  const PUSD: Address = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB"
  const WALLET = polymarketDepositWalletOf({ owner: MAIN })

  function transferData({ to = PAY_TO, amount = 5_000_000n }: { to?: Address; amount?: bigint } = {}) {
    return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] })
  }

  function batch({
    wallet = WALLET,
    calls = [{ target: PUSD, value: 0n, data: transferData() }],
    deadline = BigInt(ASKED_AT / 1000 + 240),
    depositAddress = { venue: VenueId.BYBIT, address: BYBIT_DEPOSIT, payTo: PAY_TO },
    depositVenue = VenueId.BYBIT,
  }: {
    wallet?: Address
    calls?: { target: Address; value: bigint; data: Hex }[]
    deadline?: bigint
    depositAddress?: { venue: VenueId; address: string; payTo?: string } | null
    depositVenue?: VenueId | null
  } = {}) {
    return requestOf({
      kind: SignatureRequestKind.WITHDRAWAL,
      venue: VenueId.POLYMARKET_PERPS,
      typedData: polymarketDepositWalletBatchTypedData({ wallet, nonce: 4n, deadline, calls }),
      walletChainId: 137,
      depositVenue,
      ...(depositAddress === null ? {} : { depositAddress }),
    })
  }

  test("signs one pUSD transfer from Main's own Deposit Wallet to the address the bridge gave the browser, on Polygon", () => {
    const read = signableRequest(batch())
    if (!read.ok) {
      throw new Error(read.refusal)
    }
    expect(read.summary.action).toBe(SignSummaryText.POLYMARKET_BRIDGE_INTO_BYBIT)
    expect(read.summary.chainId).toBe(137)
    expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.AMOUNT, value: "5 pUSD" })
  })

  test("refuses another payee, another wallet, more calls, another token, too little, too long, or no bridge read", () => {
    expect(refusalOf(batch({ calls: [{ target: PUSD, value: 0n, data: transferData({ to: STRANGER }) }] }))).toBe(
      SignableRefusal.NOT_BRIDGE_ADDRESS,
    )
    const other = polymarketDepositWalletOf({ owner: STRANGER })
    expect(refusalOf(batch({ wallet: other }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    const call = { target: PUSD, value: 0n, data: transferData() }
    expect(refusalOf(batch({ calls: [call, call] }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(batch({ calls: [{ ...call, target: STRANGER }] }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(batch({ calls: [{ ...call, value: 1n }] }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(batch({ calls: [{ ...call, data: transferData({ amount: 1_999_999n }) }] }))).toBe(SignableRefusal.DEPOSIT_TOO_SMALL)
    expect(refusalOf(batch({ deadline: BigInt(ASKED_AT / 1000 + 30 * 24 * 3600) }))).toBe(SignableRefusal.TOO_LONG)
    expect(refusalOf(batch({ depositAddress: { venue: VenueId.BYBIT, address: BYBIT_DEPOSIT } }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    expect(refusalOf(batch({ depositAddress: null }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    expect(refusalOf(batch({ depositVenue: VenueId.LIGHTER }))).toBe(SignableRefusal.DEPOSIT_VENUE)
  })

  /** Main's withdrawal of its Perps margin to its Deposit Wallet, the step before the bridge pays from there. */
  function perpsToWallet({
    account = MAIN,
    to = WALLET,
    token = PUSD,
    fee = 0n,
    amount = 30_000_000n,
    ts = BigInt(ASKED_AT / 1000),
    depositVenue = VenueId.BYBIT,
  }: { account?: Address; to?: Address; token?: Address; fee?: bigint; amount?: bigint; ts?: bigint; depositVenue?: VenueId } = {}) {
    return requestOf({
      kind: SignatureRequestKind.WITHDRAWAL,
      venue: VenueId.POLYMARKET_PERPS,
      typedData: {
        domain: POLYMARKET_PERPS_WITHDRAW_DOMAIN,
        types: POLYMARKET_PERPS_WITHDRAW_TYPES,
        primaryType: "Withdraw",
        message: { account, token, amount, fee, to, salt: 555_555_555n, ts },
      },
      walletChainId: 137,
      depositVenue,
    })
  }

  test("first withdraws Main's Perps margin to Main's own Deposit Wallet, in pUSD with no fee, no later than it's asked", () => {
    const read = signableRequest(perpsToWallet())
    if (!read.ok) {
      throw new Error(read.refusal)
    }
    expect(read.summary.action).toBe(SignSummaryText.POLYMARKET_PERPS_TO_WALLET)
    expect(read.summary.chainId).toBe(137)
    expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.AMOUNT, value: "30 pUSD" })
    expect(refusalOf(perpsToWallet({ to: polymarketDepositWalletOf({ owner: STRANGER }) }))).toBe(SignableRefusal.NOT_DEPOSIT_WALLET)
    expect(refusalOf(perpsToWallet({ to: MAIN }))).toBe(SignableRefusal.NOT_DEPOSIT_WALLET)
    expect(refusalOf(perpsToWallet({ account: STRANGER }))).toBe(SignableRefusal.OTHER_MAIN)
    expect(refusalOf(perpsToWallet({ token: STRANGER }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(perpsToWallet({ fee: 1n }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(perpsToWallet({ amount: 0n }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(perpsToWallet({ ts: BigInt(ASKED_AT / 1000 + 30 * 24 * 3600) }))).toBe(SignableRefusal.TOO_LONG)
    expect(refusalOf(perpsToWallet({ depositVenue: VenueId.LIGHTER }))).toBe(SignableRefusal.DEPOSIT_VENUE)
  })
})

describe("Main's address book, where the Main signer reads it", () => {
  function transferTo({ approvedRecipients, destination = SUB }: TransferToProps) {
    return requestOf({
      kind: SignatureRequestKind.TRANSFER,
      venue: VenueId.HYPERLIQUID,
      typedData: sendAsset({ destination }),
      ...(approvedRecipients === undefined ? {} : { approvedRecipients }),
    })
  }

  test("sends to a sub-account only once an entry Main's own key signed approves it", () => {
    expect(refusalOf(transferTo({ approvedRecipients: [] }))).toBe(SignableRefusal.NOT_IN_ADDRESS_BOOK)
    expect(refusalOf(transferTo({ approvedRecipients: [STRANGER] }))).toBe(SignableRefusal.NOT_IN_ADDRESS_BOOK)
    expect(signableRequest(transferTo({ approvedRecipients: [STRANGER, SUB] })).ok).toBe(true)
    const aster = { kind: SignatureRequestKind.TRANSFER, venue: VenueId.ASTER, typedData: asterTransfer({ to: SUB }) }
    expect(refusalOf(requestOf({ ...aster, approvedRecipients: [] }))).toBe(SignableRefusal.NOT_IN_ADDRESS_BOOK)
    expect(signableRequest(requestOf({ ...aster, approvedRecipients: [SUB] })).ok).toBe(true)
  })

  test("never sends to an address the user's accounts don't list as an open sub-account, though the address book names it", () => {
    for (const destination of [STRANGER, CLOSED_SUB, CLOSED_SHARED_SUB, MAIN]) {
      expect(refusalOf(transferTo({ destination, approvedRecipients: [destination] }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
  })

  test("sends to a sub-account shared with the user only once an entry of Main's own approves it: a grant alone reaches nobody", () => {
    expect(refusalOf(transferTo({ destination: SHARED_SUB, approvedRecipients: [SUB] }))).toBe(SignableRefusal.NOT_IN_ADDRESS_BOOK)
    expect(signableRequest(transferTo({ destination: SHARED_SUB, approvedRecipients: [SHARED_SUB] })).ok).toBe(true)
  })

  test("leaves the browser as it was: with no address book read, the wallet's own prompt is the user's check", () => {
    expect(signableRequest(transferTo({})).ok).toBe(true)
  })

  test("asks nothing of what sends to Main itself or LaMarge's escrow", () => {
    const toMain = hyperliquidWithdrawRequest({
      destination: MAIN,
      amount: 10,
      time: ASKED_AT,
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    const none: readonly string[] = []
    expect(
      signableRequest(
        requestOf({ kind: SignatureRequestKind.WITHDRAWAL, venue: VenueId.HYPERLIQUID, typedData: toMain, approvedRecipients: none }),
      ).ok,
    ).toBe(true)
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit(), approvedRecipients: none })).ok).toBe(
      true,
    )
  })
})

describe("a withdrawal", () => {
  test("goes to Main's own wallet only", () => {
    const toMain = hyperliquidWithdrawRequest({
      destination: MAIN,
      amount: 10,
      time: ASKED_AT,
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.WITHDRAWAL, venue: VenueId.HYPERLIQUID, typedData: toMain })).ok).toBe(
      true,
    )
    const away = hyperliquidWithdrawRequest({
      destination: STRANGER,
      amount: 10,
      time: ASKED_AT,
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.WITHDRAWAL, venue: VenueId.HYPERLIQUID, typedData: away }))).toBe(
      SignableRefusal.NOT_YOUR_ACCOUNT,
    )
  })

  describe("Main's Hyperliquid withdrawal straight into its own Lighter, which opens it", () => {
    /** Lighter's intent address for Main, as the browser read it from Lighter itself. */
    const INTENT: Address = "0x7535aA4a9B6EC46E8bA1Fb4E5ca0aD7f0cA28BD0"
    const READ = { venue: VenueId.LIGHTER, address: INTENT }

    function intoLighter({
      destination = INTENT,
      amount = 6,
      network = Network.MAINNET,
      venue = VenueId.HYPERLIQUID,
      depositVenue = VenueId.LIGHTER,
      depositAddress = READ,
      signatureChainId = 42161,
      message = {},
    }: {
      destination?: Address
      amount?: number
      network?: Network
      venue?: VenueId
      signatureChainId?: number
      /** Fields written over the withdrawal's message, as a host would change them. */
      message?: Record<string, unknown>
      /** None, for a plain withdrawal. */
      depositVenue?: VenueId | null
      /** None read, null. */
      depositAddress?: { venue: VenueId; address: string } | null
    } = {}) {
      const typedData = hyperliquidWithdrawRequest({ destination, amount, time: ASKED_AT, network, signatureChainId }).typedData
      return requestOf({
        kind: SignatureRequestKind.WITHDRAWAL,
        venue,
        typedData: { ...typedData, message: { ...typedData.message, ...message } },
        depositVenue,
        ...(depositAddress === null ? {} : { depositAddress }),
      })
    }

    test("signs it into the intent address the browser read from Lighter for Main, from 6 USDC", () => {
      const read = signableRequest(intoLighter())
      if (!read.ok) {
        throw new Error(read.refusal)
      }
      expect(read.summary.action).toBe(SignSummaryText.WITHDRAW_INTO_LIGHTER)
      expect(read.summary.chainId).toBe(42161)
      expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.AMOUNT, value: "6 USDC" })
      expect(signableRequest(intoLighter({ amount: 250.5 })).ok).toBe(true)
    })

    test("compares the addresses whatever their case, either way", () => {
      expect(signableRequest(intoLighter({ depositAddress: { venue: VenueId.LIGHTER, address: INTENT.toLowerCase() } })).ok).toBe(true)
      expect(signableRequest(intoLighter({ message: { destination: INTENT.toLowerCase() } })).ok).toBe(true)
      expect(
        signableRequest(intoLighter({ depositAddress: { venue: VenueId.LIGHTER, address: `0x${INTENT.slice(2).toUpperCase()}` } })).ok,
      ).toBe(true)
      // A different address stays refused in any case.
      expect(refusalOf(intoLighter({ message: { destination: STRANGER.toLowerCase() } }))).toBe(SignableRefusal.NOT_DEPOSIT_ADDRESS)
    })

    test("refuses another address than the one read, Main's own among them", () => {
      expect(refusalOf(intoLighter({ destination: STRANGER }))).toBe(SignableRefusal.NOT_DEPOSIT_ADDRESS)
      expect(refusalOf(intoLighter({ destination: MAIN }))).toBe(SignableRefusal.NOT_DEPOSIT_ADDRESS)
    })

    test("refuses the address the request names alone, with none read from Lighter, or one read for another venue", () => {
      expect(refusalOf(intoLighter({ depositAddress: null }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
      expect(refusalOf(intoLighter({ depositAddress: { venue: VenueId.ASTER, address: INTENT } }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    })

    test("refuses another venue to open, or another venue withdrawing", () => {
      expect(refusalOf(intoLighter({ depositVenue: VenueId.ASTER, depositAddress: { venue: VenueId.ASTER, address: INTENT } }))).toBe(
        SignableRefusal.DEPOSIT_VENUE,
      )
      expect(refusalOf(intoLighter({ venue: VenueId.ASTER }))).toBe(SignableRefusal.DEPOSIT_VENUE)
    })

    test("refuses less than 6 USDC, Hyperliquid's $1 fee and Lighter's 5 USDC least", () => {
      expect(refusalOf(intoLighter({ amount: 5.99 }))).toBe(SignableRefusal.DEPOSIT_TOO_SMALL)
    })

    test("refuses it on Hyperliquid's testnet, or naming another Hyperliquid chain than Mainnet", () => {
      expect(refusalOf(intoLighter({ network: Network.TESTNET }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoLighter({ message: { hyperliquidChain: "Testnet" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    })

    test("refuses a message with a field more, or an amount not written as a plain decimal", () => {
      expect(refusalOf(intoLighter({ message: { memo: "leneutre" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoLighter({ message: { amount: "6e0" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoLighter({ message: { amount: 6 } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    })

    test("refuses a signing domain on a chain outside the allowlist", () => {
      expect(refusalOf(intoLighter({ signatureChainId: 1234 }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
    })

    test("refuses the intent address as a plain withdrawal's destination: only Main's own wallet is", () => {
      expect(refusalOf(intoLighter({ depositVenue: null }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    })
  })

  describe("Main's Hyperliquid send through CCTP straight into its own Bybit, by the deposit address Main signed", () => {
    /** Main's Bybit deposit address on Arbitrum, as the browser took it once Main's signature of it recovered Main. */
    const BYBIT_DEPOSIT: Address = "0x52c336060d171d2f27baa3d1d3b156fb4a79289c"
    const READ = { venue: VenueId.BYBIT, address: BYBIT_DEPOSIT }

    function intoBybit({
      destination = BYBIT_DEPOSIT,
      amount = 5,
      domain = 3,
      depositVenue = VenueId.BYBIT,
      depositAddress = READ,
      message = {},
    }: {
      destination?: Address
      amount?: number
      /** The CCTP domain it pays on: Arbitrum's is 3, Polygon's 7. */
      domain?: number
      depositVenue?: VenueId | null
      /** None read, null. */
      depositAddress?: { venue: VenueId; address: string } | null
      /** Fields written over the send's message, as a host would change them. */
      message?: Record<string, unknown>
    } = {}) {
      const typedData = hyperliquidCctpSendRequest({
        destination,
        amount,
        domain,
        nonce: ASKED_AT,
        network: Network.MAINNET,
        signatureChainId: 42161,
      }).typedData
      return requestOf({
        kind: SignatureRequestKind.WITHDRAWAL,
        venue: VenueId.HYPERLIQUID,
        typedData: { ...typedData, message: { ...typedData.message, ...message } },
        depositVenue,
        ...(depositAddress === null ? {} : { depositAddress }),
      })
    }

    test("signs it to the address Main signed, on Arbitrum's CCTP domain, from spot, as measured on mainnet", () => {
      const read = signableRequest(intoBybit())
      if (!read.ok) {
        throw new Error(read.refusal)
      }
      expect(read.summary.action).toBe(SignSummaryText.CCTP_INTO_BYBIT)
      expect(read.summary.chainId).toBe(42161)
      expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.AMOUNT, value: "5 USDC" })
      expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.DESTINATION_CHAIN, value: "42161" })
    })

    test("refuses another recipient, the request's address alone, another venue, and another chain than the one Main signed on", () => {
      expect(refusalOf(intoBybit({ destination: STRANGER }))).toBe(SignableRefusal.NOT_DEPOSIT_ADDRESS)
      expect(refusalOf(intoBybit({ destination: MAIN }))).toBe(SignableRefusal.NOT_DEPOSIT_ADDRESS)
      expect(refusalOf(intoBybit({ depositAddress: null }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
      expect(refusalOf(intoBybit({ depositAddress: { venue: VenueId.LIGHTER, address: BYBIT_DEPOSIT } }))).toBe(
        SignableRefusal.DEPOSIT_UNREAD,
      )
      // Lighter's intent address isn't measured to credit a CCTP mint: no CCTP send goes there.
      expect(
        refusalOf(intoBybit({ depositVenue: VenueId.LIGHTER, depositAddress: { venue: VenueId.LIGHTER, address: BYBIT_DEPOSIT } })),
      ).toBe(SignableRefusal.DEPOSIT_VENUE)
      expect(refusalOf(intoBybit({ domain: 7 }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
    })

    test("refuses less than the least, call data, another gas limit, a perps source or another token", () => {
      expect(refusalOf(intoBybit({ amount: 1.5 }))).toBe(SignableRefusal.DEPOSIT_TOO_SMALL)
      expect(refusalOf(intoBybit({ message: { data: "0xdeadbeef" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoBybit({ message: { gasLimit: 900_000 } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoBybit({ message: { sourceDex: "" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoBybit({ message: { token: "USDT" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
      expect(refusalOf(intoBybit({ message: { memo: "leneutre" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    })

    test("refuses a CCTP send that names no venue: Main's own wallet is paid by withdraw3 only", () => {
      expect(signableRequest(intoBybit({ depositVenue: null })).ok).toBe(false)
    })
  })
})

describe("a LaMarge move", () => {
  test("signs a permit only to the escrow of the deployment the request is for, though LaMarge's SDK reviews both", () => {
    const toDevelopment = permit({ spender: DEVELOPMENT_ESCROW })
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: toDevelopment, lamarge: LAMARGE_DEV })).ok).toBe(
      true,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: toDevelopment }))).toBe(
      SignableRefusal.OTHER_DEPLOYMENT_ESCROW,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit(), lamarge: LAMARGE_DEV }))).toBe(
      SignableRefusal.OTHER_DEPLOYMENT_ESCROW,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit(), lamarge: null }))).toBe(
      SignableRefusal.UNKNOWN_DEPLOYMENT,
    )
  })

  test("pays into the escrow of the deployment the request is for, each delivery from it too", () => {
    const move = ({ typedData, lamarge }: { typedData: ReturnType<typeof payTake>; lamarge?: LaMargeRequestContext }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData, ...(lamarge === undefined ? {} : { lamarge }) })
    const read = signableRequest(move({ typedData: payTake() }))
    expect(read.ok && read.summary.action).toBe(SignSummaryText.LAMARGE_PAYMENT)
    const development = payTake({ escrow: DEVELOPMENT_ESCROW, receiveEscrow: DEVELOPMENT_ESCROW })
    expect(signableRequest(move({ typedData: development, lamarge: LAMARGE_DEV })).ok).toBe(true)
    // Into the other deployment's escrow, or delivered from it.
    expect(refusalOf(move({ typedData: development }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(move({ typedData: payTake({ receiveEscrow: DEVELOPMENT_ESCROW }) }))).toBe(SignableRefusal.OTHER_DEPLOYMENT_ESCROW)
    expect(refusalOf(move({ typedData: payTake(), lamarge: LAMARGE_DEV }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    // Into Aster, from its vault alone, whatever the deployment: never its retired escrow on BSC.
    expect(signableRequest(move({ typedData: payTake({ into: "aster", receiveEscrow: CHAINS.aster?.escrow ?? "" }) })).ok).toBe(true)
    expect(refusalOf(move({ typedData: payTake({ into: "aster", receiveEscrow: ESCROW }) }))).toBe(SignableRefusal.OTHER_DEPLOYMENT_ESCROW)
    // A delivery on a chain LaMarge names for no venue.
    expect(refusalOf(move({ typedData: payTake({ receiveChainId: "1" }) }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
    // Nor into a venue lebroker doesn't trade, though LaMarge's SDK pins its chain and its development escrow: GMX's.
    const intoGmx = payTake({ escrow: DEVELOPMENT_ESCROW, into: "gmx", receiveEscrow: ARBITRUM_ESCROW })
    expect(refusalOf(move({ typedData: intoGmx, lamarge: LAMARGE_DEV }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
  })

  test("pays from Main's own USDC on Arbitrum into the dev escrow LaMarge pins there, delivered to Main on the venue it trades", () => {
    const arbitrum = CHAINS.gmx
    const onArbitrum = ({ escrow = ARBITRUM_ESCROW, payments }: { escrow?: string; payments?: ReturnType<typeof lockPayment>[] }) => ({
      ...payTake({ escrow, receiveEscrow: DEVELOPMENT_ESCROW, ...(payments === undefined ? {} : { payments }) }),
      domain: { name: "LaMarge", version: "1", chainId: arbitrum?.id, verifyingContract: escrow },
    })
    const arbitrumPermit = {
      ...permit({ spender: ARBITRUM_ESCROW }),
      domain: { name: arbitrum?.permit, version: arbitrum?.version, chainId: arbitrum?.id, verifyingContract: arbitrum?.token },
    }
    const move = ({ typedData, lamarge = LAMARGE_DEV }: { typedData: Record<string, unknown>; lamarge?: LaMargeRequestContext }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData, lamarge })
    const permitted = signableRequest(move({ typedData: arbitrumPermit }))
    expect(permitted.ok && permitted.summary).toMatchObject({ action: SignSummaryText.LAMARGE_PERMIT, chainId: 42161 })
    const paid = signableRequest(move({ typedData: onArbitrum({}) }))
    expect(paid.ok && paid.summary).toMatchObject({ action: SignSummaryText.LAMARGE_PAYMENT, chainId: 42161 })
    // Production pins no escrow on Arbitrum yet: the dev one is another environment's there.
    expect(refusalOf(move({ typedData: arbitrumPermit, lamarge: LAMARGE_PRODUCTION }))).toBe(SignableRefusal.OTHER_DEPLOYMENT_ESCROW)
    expect(refusalOf(move({ typedData: onArbitrum({}), lamarge: LAMARGE_PRODUCTION }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    // Delivered to Main alone, and within the same 1.5 % floor as any take.
    const toStranger = lockPayment({
      to: "hyperliquid",
      receiveEscrow: DEVELOPMENT_ESCROW,
      receiveRecipient: STRANGER,
      amountOut: "60000000",
    })
    expect(refusalOf(move({ typedData: onArbitrum({ payments: [toStranger] }) }))).toBe(SignableRefusal.NOT_TAKE_RECIPIENT)
    const lossy = lockPayment({ to: "hyperliquid", receiveEscrow: DEVELOPMENT_ESCROW, amountOut: "59000000" })
    expect(refusalOf(move({ typedData: onArbitrum({ payments: [lossy] }) }))).toBe(SignableRefusal.TAKE_LOSS)
    // Arbitrum is a chain Main pays from only: nothing is delivered into it.
    const intoArbitrum = lockPayment({ to: "gmx", receiveEscrow: ARBITRUM_ESCROW, amountOut: "60000000" })
    const fromHyperEvm = payTake({ escrow: DEVELOPMENT_ESCROW, payments: [intoArbitrum] })
    expect(refusalOf(move({ typedData: fromHyperEvm }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
  })

  test("pays a take only as LaMarge's verified attestation commits it: its venues and its recipient, a take's and never a setup's", () => {
    const paid = payTake({ escrow: DEVELOPMENT_ESCROW, receiveEscrow: DEVELOPMENT_ESCROW })
    const terms = {
      take: `0x${"00".repeat(32)}`,
      from: "hyperliquid",
      to: "hyperliquid",
      recipient: MAIN.toLowerCase(),
      token: CHAINS.hyperliquid?.token ?? "",
      amountOut: "60000000",
      payBy: ASKED_AT / 1000 + 45,
    }
    const attested = (attestation: Attested) => ({
      ...requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: paid, lamarge: LAMARGE_DEV }),
      attested: attestation,
    })
    expect(signableRequest(attested({ kind: "take", terms })).ok).toBe(true)
    for (const other of [{ recipient: STRANGER.toLowerCase() }, { to: "polymarket" }, { from: "polymarket" }]) {
      expect(refusalOf(attested({ kind: "take", terms: { ...terms, ...other } }))).toBe(SignableRefusal.NOT_ATTESTED_TAKE)
    }
    expect(refusalOf(attested({ kind: "setup" }))).toBe(SignableRefusal.NOT_ATTESTED_TAKE)
  })

  test("pays a take that delivers to Main itself, never to an address the request names", () => {
    const take = ({ payments }: { payments: ReturnType<typeof lockPayment>[] }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: payTake({ payments }) })
    expect(signableRequest(take({ payments: [lockPayment()] })).ok).toBe(true)
    expect(signableRequest(take({ payments: [lockPayment({ receiveRecipient: MAIN.toLowerCase() })] })).ok).toBe(true)
    expect(refusalOf(take({ payments: [lockPayment({ receiveRecipient: STRANGER })] }))).toBe(SignableRefusal.NOT_TAKE_RECIPIENT)
    // Not even one of the user's own sub-accounts: lebroker's takes deliver to the account that pays.
    expect(refusalOf(take({ payments: [lockPayment({ receiveRecipient: SUB })] }))).toBe(SignableRefusal.NOT_TAKE_RECIPIENT)
    expect(refusalOf(take({ payments: [lockPayment(), lockPayment({ receiveRecipient: STRANGER })] }))).toBe(
      SignableRefusal.NOT_TAKE_RECIPIENT,
    )
  })

  test("pays a take that delivers straight to Main's Bybit deposit address only as the browser read it, Main's signature recovered", () => {
    // Main's Bybit deposit address on Arbitrum, as the browser took it once Main's `MainBybitDepositAddress` recovered Main.
    const deposit: Address = "0x52C336060D171d2F27Baa3d1D3b156Fb4a79289C"
    const intoBybit = ({
      receiveRecipient = deposit,
      depositVenue = VenueId.BYBIT,
      depositAddress = { venue: VenueId.BYBIT, address: deposit },
    }: {
      receiveRecipient?: string
      depositVenue?: VenueId | null
      depositAddress?: { venue: VenueId; address: string } | null
    } = {}) =>
      requestOf({
        kind: SignatureRequestKind.LAMARGE_MOVE,
        // A take whose native USDC is delivered on Arbitrum, its recipient where lamarge#395 asks it named.
        typedData: payTake({
          payments: [lockPayment({ to: "hyperliquid", receiveEscrow: ESCROW, receiveRecipient, amountOut: "60000000" })],
        }),
        depositVenue,
        ...(depositAddress === null ? {} : { depositAddress }),
      })
    const read = signableRequest(intoBybit())
    if (!read.ok) {
      throw new Error(read.refusal)
    }
    expect(read.summary.lines).toContainEqual({ label: SignSummaryLabel.DEPOSIT_ADDRESS, value: shortAddress({ address: deposit }) })
    expect(signableRequest(intoBybit({ receiveRecipient: deposit.toLowerCase() })).ok).toBe(true)
    // Main itself still, whatever the request names beside it.
    expect(signableRequest(intoBybit({ receiveRecipient: MAIN })).ok).toBe(true)
    // An address the browser didn't read for Main, one read for another venue, or none read.
    expect(refusalOf(intoBybit({ receiveRecipient: STRANGER }))).toBe(SignableRefusal.NOT_TAKE_RECIPIENT)
    expect(refusalOf(intoBybit({ depositAddress: null }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    expect(refusalOf(intoBybit({ depositAddress: { venue: VenueId.LIGHTER, address: deposit } }))).toBe(SignableRefusal.DEPOSIT_UNREAD)
    // Only into a venue LaMarge reaches on chain alone: never another venue's deposit address, nor with no venue named.
    expect(refusalOf(intoBybit({ depositVenue: VenueId.LIGHTER, depositAddress: { venue: VenueId.LIGHTER, address: deposit } }))).toBe(
      SignableRefusal.NOT_TAKE_RECIPIENT,
    )
    expect(refusalOf(intoBybit({ depositVenue: null }))).toBe(SignableRefusal.NOT_TAKE_RECIPIENT)
  })

  test("pays a take that delivers its venue's own token on its chain, every payment on the same one", () => {
    const take = ({ payments }: { payments: ReturnType<typeof lockPayment>[] }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: payTake({ payments }) })
    const onHyperEvm = lockPayment({ to: "hyperliquid", receiveEscrow: ESCROW, amountOut: "60000000" })
    expect(signableRequest(take({ payments: [onHyperEvm] })).ok).toBe(true)
    expect(
      signableRequest(take({ payments: [lockPayment({ receiveToken: `0x${CHAINS.aster?.token.slice(2).toUpperCase() ?? ""}` })] })).ok,
    ).toBe(true)
    // BSC's USDT said delivered on HyperEVM, or any token but the venue's own.
    const bscOnHyperEvm = lockPayment({
      to: "hyperliquid",
      receiveEscrow: ESCROW,
      receiveToken: CHAINS.aster?.token,
      amountOut: "60000000",
    })
    expect(refusalOf(take({ payments: [bscOnHyperEvm] }))).toBe(SignableRefusal.NOT_TAKE_DELIVERY)
    expect(refusalOf(take({ payments: [lockPayment({ receiveToken: STRANGER })] }))).toBe(SignableRefusal.NOT_TAKE_DELIVERY)
    expect(refusalOf(take({ payments: [lockPayment(), lockPayment({ receiveToken: CHAINS.hyperliquid?.token })] }))).toBe(
      SignableRefusal.NOT_TAKE_DELIVERY,
    )
    // One take delivers on one chain: a payment into Aster beside one on HyperEVM is refused.
    expect(refusalOf(take({ payments: [lockPayment(), onHyperEvm] }))).toBe(SignableRefusal.NOT_TAKE_DELIVERY)
  })

  test("pays a sweep whose costly fill the whole take makes up for, and refuses one whose total loses past 1.5 %", () => {
    const take = ({ payments }: { payments: ReturnType<typeof lockPayment>[] }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: payTake({ payments }) })
    // 60 USDC for 60 USDT, then 40 for 39 (2.5 % on that fill): 99 for 100, 1 % on the take.
    const costly = lockPayment({ amount: "40000000", amountOut: "39000000000000000000" })
    expect(signableRequest(take({ payments: [lockPayment(), costly] })).ok).toBe(true)
    // 59.5 then 39 for 100: 1.5 % on the take, the floor itself; a base unit under it is refused.
    expect(signableRequest(take({ payments: [lockPayment({ amountOut: "59500000000000000000" }), costly] })).ok).toBe(true)
    expect(refusalOf(take({ payments: [lockPayment({ amountOut: "59499999999999999999" }), costly] }))).toBe(SignableRefusal.TAKE_LOSS)
    // 59 then 39 for 100: 2 % on the take.
    expect(refusalOf(take({ payments: [lockPayment({ amountOut: "59000000000000000000" }), costly] }))).toBe(SignableRefusal.TAKE_LOSS)
  })

  test("pays a take inside Lighter by the key of the deployment the request is for only", () => {
    const development = lighterTransferText({ apiKey: ENVIRONMENT_SLOTS.development.lighterKeyIndex })
    expect(signableRequest(lighterTakeRequest({ message: development, lamarge: LAMARGE_DEV })).ok).toBe(true)
    expect(refusalOf(lighterTakeRequest({ message: development }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(lighterTakeRequest({ lamarge: LAMARGE_DEV }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("registers LaMarge's Lighter key at the index of the deployment the request is for only", () => {
    const keyAt = ({ apiKeyIndex, lamarge }: { apiKeyIndex: number; lamarge: LaMargeRequestContext }) =>
      requestOf({
        kind: SignatureRequestKind.LAMARGE_MOVE,
        message: registrationMessage({ accountIndex: 42, apiKeyIndex }),
        lamarge: { ...lamarge, lighterAccountIndex: 42 },
      })
    const development = ENVIRONMENT_SLOTS.development.lighterKeyIndex
    const production = ENVIRONMENT_SLOTS.production.lighterKeyIndex
    expect(signableRequest(keyAt({ apiKeyIndex: development, lamarge: LAMARGE_DEV })).ok).toBe(true)
    // The other deployment's index would replace that deployment's key.
    expect(refusalOf(keyAt({ apiKeyIndex: development, lamarge: LAMARGE_PRODUCTION }))).toBe(SignableRefusal.OTHER_DEPLOYMENT_KEY)
    expect(refusalOf(keyAt({ apiKeyIndex: production, lamarge: LAMARGE_DEV }))).toBe(SignableRefusal.OTHER_DEPLOYMENT_KEY)
  })

  test("signs a withdrawal LaMarge relays only back to Main", () => {
    const toEvm = hyperliquidSendAssetRequest({
      destination: "0x2000000000000000000000000000000000000000",
      sourceDex: "",
      destinationDex: "spot",
      token: HYPERLIQUID_USDC,
      amount: 25,
      nonce: ASKED_AT,
      network: Network.MAINNET,
      signatureChainId: 999,
    }).typedData
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: toEvm })).ok).toBe(true)
    expect(
      refusalOf(
        requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: sendAsset({ destination: STRANGER, signatureChainId: 999 }) }),
      ),
    ).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("reads a take's windows, a permit's deadline and a sign-in's expiry at the time it's read, not when it was asked", () => {
    expect(signableRequest({ ...asterTakeRequest(), now: TAKE_ASKED_AT + 30_000 }).ok).toBe(true)
    expect(refusalOf({ ...asterTakeRequest(), now: TAKE_ASKED_AT + 10 * 60_000 })).toStartWith(SignableRefusal.LAMARGE_CHECK)
    const late = ASKED_AT + 10 * 60_000
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit(), now: late }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
    const signInMessage = signIn({ host: "app.lamarge.trade" })
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signInMessage, now: late }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
  })

  test("pays a route's first take inside Aster that LaMarge moved to the route's deadline: its nonce past the next 70 s, up to 20 s past its pay_by", () => {
    // As LaMarge prepares a route from Aster: the take's pay_by 90 s on, its transfer's nonce 20 s past it.
    const moved = asterTake({ fill: { pay_by: new Date(TAKE_ASKED_AT + 90_000).toISOString() } })
    expect(signableRequest(asterTakeRequest({ msg: takeMessageAt({ ms: 110_000 }), take: moved })).ok).toBe(true)
    expect(refusalOf(asterTakeRequest({ msg: takeMessageAt({ ms: 111_000 }), take: moved }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    // A take LaMarge didn't move keeps its nonce within the next 70 s.
    expect(refusalOf(asterTakeRequest({ msg: takeMessageAt({ ms: 110_000 }) }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses a payment inside Aster that names no take, LaMarge's Aster vault included", () => {
    expect(refusalOf(asterTakeRequest({ take: null }))).toBe(SignableRefusal.NO_TAKE)
    const vault = TAKE_MESSAGE.replace(TAKE_MAKER, CHAINS.aster?.escrow ?? "")
    expect(refusalOf(asterTakeRequest({ msg: vault, take: null }))).toBe(SignableRefusal.NO_TAKE)
  })

  test("refuses a payment of a take asked before fees, which names no taker fee", () => {
    const beforeFees = asterTake({ fill: { taker_fee: undefined } })
    expect(refusalOf(asterTakeRequest({ take: beforeFees }))).toBe(SignableRefusal.NO_TAKER_FEE)
  })

  test("refuses a payment inside Aster that differs from the take's fill: its amount, its id, its payer, its taker", () => {
    expect(refusalOf(asterTakeRequest({ msg: TAKE_MESSAGE.replace("amount=62.13", "amount=62.14") }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
    expect(refusalOf(asterTakeRequest({ msg: TAKE_MESSAGE.replace("clientTranId=01a155d9", "clientTranId=11a155d9") }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
    expect(refusalOf(asterTakeRequest({ msg: TAKE_MESSAGE.replace(`user=${TAKE_MAIN}`, `user=${STRANGER}`) }))).toBe(
      SignableRefusal.OTHER_MAIN,
    )
    expect(refusalOf(asterTakeRequest({ take: asterTake({ fill: { taker_recipient: STRANGER } }) }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
    expect(
      refusalOf(asterTakeRequest({ take: asterTake({ fill: { pay_by: new Date(TAKE_ASKED_AT - 1000).toISOString() } }) })),
    ).toStartWith(SignableRefusal.LAMARGE_CHECK)
    const twice = asterTake()
    expect(refusalOf(asterTakeRequest({ take: { ...twice, fills: [...twice.fills, ...twice.fills] } }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
  })

  test("pays a take inside Lighter to the maker's account the take names, and says what it signs and who started the move", () => {
    // LaMarge's SDK writes the message the request carries, byte for byte.
    expect(lighterTransferText()).toBe(LIGHTER_TAKE_MESSAGE)
    const read = signableRequest(lighterTakeRequest())
    expect(read.ok && read.summary).toEqual({
      action: SignSummaryText.LAMARGE_LIGHTER_TAKE,
      lines: [
        { label: SignSummaryLabel.AMOUNT, value: "2.0013" },
        { label: SignSummaryLabel.LIGHTER_FEE, value: "0" },
        { label: SignSummaryLabel.MAKER_LIGHTER, value: "731033" },
        { label: SignSummaryLabel.STARTED_BY, value: SignStarter.USER },
      ],
      chainId: null,
    })
    const keeper = signableRequest(lighterTakeRequest({ reason: SignatureRequestReason.MARGIN_KEEPER }))
    expect(keeper.ok && keeper.summary.lines.at(-1)).toEqual({ label: SignSummaryLabel.STARTED_BY, value: SignStarter.MARGIN_KEEPER })
    // Lighter's fee, up to its 1 USDC cap, is said beside it.
    const fee = signableRequest(lighterTakeRequest({ message: lighterTransferText({ fee: 1_000_000n }) }))
    expect(fee.ok && fee.summary.lines[1]).toEqual({ label: SignSummaryLabel.LIGHTER_FEE, value: "1" })
  })

  test("refuses a payment inside Lighter that names no take, or a take without the accounts it goes between", () => {
    expect(refusalOf(lighterTakeRequest({ take: null }))).toBe(SignableRefusal.NO_TAKE)
    expect(refusalOf(lighterTakeRequest({ take: lighterTake({ lighter: null }) }))).toBe(SignableRefusal.NOT_TAKE_ACCOUNTS)
  })

  test("refuses a payment inside Lighter to another account than the take's maker's, or from another than Main's", () => {
    for (const to of [731_034, 42, 0]) {
      expect(refusalOf(lighterTakeRequest({ message: lighterTransferText({ to }) }))).toBe(SignableRefusal.NOT_TAKE_ACCOUNTS)
    }
    for (const lighter of [
      { from_account_index: 42, to_account_index: 7 },
      { from_account_index: 43, to_account_index: 731_033 },
    ]) {
      expect(refusalOf(lighterTakeRequest({ take: lighterTake({ lighter }) }))).toBe(SignableRefusal.NOT_TAKE_ACCOUNTS)
    }
  })

  test("refuses Lighter's message for a take asked as anything but a LaMarge move: a transfer, a withdrawal, a setup", () => {
    // As Main's own transfer, a take's message names LaMarge's key, never one of lebroker's.
    expect(refusalOf(lighterTakeRequest({ kind: SignatureRequestKind.TRANSFER }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
    expect(refusalOf(lighterTakeRequest({ kind: SignatureRequestKind.WITHDRAWAL }))).toBe(SignableRefusal.OPAQUE)
    expect(refusalOf(lighterTakeRequest({ kind: SignatureRequestKind.VENUE_SETUP }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("signs in on LaMarge's app and registers LaMarge's Lighter key, and nothing else in words", () => {
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signIn({ host: "app.lamarge.trade" }) })).ok).toBe(
      true,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signIn({ host: "app.evil.example" }) }))).toBe(
      SignableRefusal.OPAQUE,
    )
    const key = registrationMessage({ accountIndex: 42, apiKeyIndex: TAKER_API_KEY })
    const main = { ...LAMARGE_PRODUCTION, lighterAccountIndex: 42 }
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: key, lamarge: main })).ok).toBe(true)
  })

  test("signs in only on the app of the LaMarge the request is for, never another deployment's", () => {
    const signInTo = ({ host, lamarge }: { host: string; lamarge: LaMargeRequestContext | null }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signIn({ host }), lamarge })
    expect(signableRequest(signInTo({ host: "app.dev.lamarge.trade", lamarge: LAMARGE_DEV })).ok).toBe(true)
    expect(refusalOf(signInTo({ host: "app.lamarge.trade", lamarge: LAMARGE_DEV }))).toBe(SignableRefusal.UNKNOWN_DEPLOYMENT)
    expect(refusalOf(signInTo({ host: "app.dev.lamarge.trade", lamarge: LAMARGE_PRODUCTION }))).toBe(SignableRefusal.UNKNOWN_DEPLOYMENT)
    expect(refusalOf(signInTo({ host: "app.lamarge.trade", lamarge: null }))).toBe(SignableRefusal.UNKNOWN_DEPLOYMENT)
    expect(refusalOf(signInTo({ host: "app.lamarge.trade", lamarge: { appOrigin: "https://app.evil.example" } }))).toBe(
      SignableRefusal.UNKNOWN_DEPLOYMENT,
    )
  })

  test("registers LaMarge's Lighter key on Main's own Lighter account only, as the executor read it", () => {
    const key = registrationMessage({ accountIndex: 42, apiKeyIndex: TAKER_API_KEY })
    const keyFor = ({ lamarge }: { lamarge: LaMargeRequestContext | null }) =>
      requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: key, lamarge })
    expect(refusalOf(keyFor({ lamarge: { ...LAMARGE_PRODUCTION, lighterAccountIndex: 43 } }))).toBe(
      SignableRefusal.NOT_MAIN_LIGHTER_ACCOUNT,
    )
    expect(refusalOf(keyFor({ lamarge: LAMARGE_PRODUCTION }))).toBe(SignableRefusal.NOT_MAIN_LIGHTER_ACCOUNT)
    expect(refusalOf(keyFor({ lamarge: null }))).toBe(SignableRefusal.NOT_MAIN_LIGHTER_ACCOUNT)
  })

  test("approves LaMarge's Aster agent under the name of the deployment the request is for only", () => {
    const nonce = String(ASKED_AT * 1000)
    const expired = String(ASKED_AT + 365 * DAY_MS)
    const approve = ({ name, lamarge }: { name: string; lamarge: LaMargeRequestContext | null }) =>
      requestOf({
        kind: SignatureRequestKind.LAMARGE_MOVE,
        typedData: asterMessage({
          msg: `user=${MAIN}&nonce=${nonce}&agentName=${name}&agentAddress=${AGENT}&expired=${expired}&signatureChainId=56&canSpotTrade=false&canPerpTrade=true&canWithdraw=false`,
          chainId: 56,
        }),
        lamarge,
      })
    const production = signableRequest(approve({ name: "LaMarge", lamarge: LAMARGE_PRODUCTION }))
    expect(production.ok && production.summary.action).toBe(SignSummaryText.LAMARGE_ASTER_AGENT)
    expect(signableRequest(approve({ name: "LaMargeDev", lamarge: LAMARGE_DEV })).ok).toBe(true)
    // The other deployment's name would revoke that deployment's agent.
    expect(refusalOf(approve({ name: "LaMargeDev", lamarge: LAMARGE_PRODUCTION }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(approve({ name: "LaMarge", lamarge: LAMARGE_DEV }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(approve({ name: "LaMarge", lamarge: null }))).toBe(SignableRefusal.UNKNOWN_DEPLOYMENT)
  })

  test("refuses typed data on a domain LaMarge doesn't pin, as a Permit2 approval", () => {
    const permit2 = {
      ...permit(),
      domain: { name: "Permit2", chainId: 1, verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3" },
    }
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit2 }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
  })
})

describe("a LaMarge send to another of the user's accounts on the same venue", () => {
  const POLYMARKET_TOKEN = CHAINS.polymarket?.token ?? ""

  /**
   * A Polymarket send as LaMarge's SDK prepares it: the operation, and its typed data, whose `data` the operation's hash,
   * timed when it was asked; its terms as the executor names them, 12.5 pUSD to the user's open sub-account.
   */
  function polymarketSend({
    to = SUB,
    amount = "12.5",
    data,
    ts = ASKED_AT,
    send = {},
  }: { to?: string; amount?: string; data?: string; ts?: number; send?: Partial<LaMargeSend> } = {}) {
    const args = { account: MAIN, token: POLYMARKET_TOKEN, amount, to }
    const typedData = {
      domain: { name: "Polymarket", version: "1", chainId: 137 },
      types: schemas.Op,
      primaryType: "Op",
      message: { data: data ?? opHash("internalTransfer", [args.account, args.token, args.amount, args.to]), salt: 7, ts },
    }
    const terms: LaMargeSend = { venue: "polymarket", recipient: SUB, amount: "12500000", op: { type: "internalTransfer", args }, ...send }
    return requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData, send: terms })
  }

  /**
   * The user's open sub-account, at another address than the fixtures': theirs, 0x2222…2222, is Hyperliquid's HYPE system
   * address, which LaMarge's SDK never sends to.
   */
  const HYPERLIQUID_SUB = "0x6666666666666666666666666666666666666666"

  /** A Hyperliquid send as LaMarge prepares it: `sendAsset` in HyperEVM's domain, to the recipient, 12.5 USDC. */
  function hyperliquidSend({ to = HYPERLIQUID_SUB, recipient = HYPERLIQUID_SUB }: { to?: string; recipient?: string } = {}) {
    const typedData = {
      domain: {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 999,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      },
      types: schemas["HyperliquidTransaction:SendAsset"],
      primaryType: "HyperliquidTransaction:SendAsset",
      message: {
        hyperliquidChain: "Mainnet",
        destination: to.toLowerCase(),
        sourceDex: "",
        destinationDex: "",
        token: HYPERLIQUID_USDC,
        amount: "12.5",
        fromSubAccount: "",
        nonce: ASKED_AT,
      },
    }
    const asked = requestOf({
      kind: SignatureRequestKind.LAMARGE_MOVE,
      typedData,
      send: { venue: "hyperliquid", recipient, amount: "12500000" },
    })
    return {
      ...asked,
      accounts: asked.accounts.map(account => (account.address === SUB ? { ...account, address: HYPERLIQUID_SUB } : account)),
    }
  }

  test("signs a Polymarket send of exactly its amount to one of the user's open sub-accounts, its hash rebuilt", () => {
    const read = signableRequest(polymarketSend())
    expect(read.ok && read.summary.action).toBe(SignSummaryText.LAMARGE_SEND)
    expect(read.ok && read.summary.chainId).toBe(137)
    expect(read.ok && read.summary.lines.some(line => line.label === SignSummaryLabel.TO && line.value.startsWith("Sub-account 1"))).toBe(
      true,
    )
  })

  test("never sends to anyone but one of the user's open sub-accounts, or one shared with them, whatever the request names", () => {
    for (const recipient of [STRANGER, CLOSED_SUB, CLOSED_SHARED_SUB, MAIN]) {
      expect(refusalOf(polymarketSend({ to: recipient, send: { recipient } }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
    expect(refusalOf(hyperliquidSend({ to: STRANGER, recipient: STRANGER }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    const shared = signableRequest(polymarketSend({ to: SHARED_SUB, send: { recipient: SHARED_SUB } }))
    expect(shared.ok && shared.summary.lines.some(line => line.label === SignSummaryLabel.TO && line.value.startsWith("Hedges of"))).toBe(
      true,
    )
  })

  test("refuses an operation to another account than the one it names, though it's the user's own", () => {
    expect(refusalOf(polymarketSend({ to: STRANGER }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(hyperliquidSend({ to: STRANGER }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses any other amount than the one the request names", () => {
    expect(refusalOf(polymarketSend({ amount: "13" }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(polymarketSend({ send: { amount: "12500001" } }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses a hash that isn't the operation's, an operation from another account, and a stale one", () => {
    expect(refusalOf(polymarketSend({ data: `0x${"ab".repeat(32)}` }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    const fromStranger = polymarketSend()
    const payload = fromStranger.request.payload
    if (payload.kind === SignaturePayloadKind.TYPED_DATA && payload.send?.op !== undefined) {
      payload.send.op.args.account = STRANGER
    }
    expect(refusalOf(fromStranger)).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(polymarketSend({ ts: ASKED_AT - 120_000 }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses a Polymarket send without the operation it hashes: its prompt shows only the hash", () => {
    const blind = polymarketSend()
    const payload = blind.request.payload
    if (payload.kind === SignaturePayloadKind.TYPED_DATA && payload.send !== undefined) {
      payload.send = { venue: payload.send.venue, recipient: payload.send.recipient, amount: payload.send.amount }
    }
    expect(refusalOf(blind)).toBe(SignableRefusal.NO_SEND_OP)
  })

  test("signs Hyperliquid's send to the user's open sub-account, never read as a withdrawal to Main", () => {
    const read = signableRequest(hyperliquidSend())
    expect(read.ok && read.summary.action).toBe(SignSummaryText.LAMARGE_SEND)
  })

  /** An Aster send as LaMarge prepares it: Aster's transfer between wallets, under a send's own id (`s`, 32 hex digits). */
  function asterSend({ to = SUB, recipient = SUB, id = `s${"0a".repeat(16)}` }: { to?: string; recipient?: string; id?: string } = {}) {
    const msg = new URLSearchParams([
      ["asset", "USDT"],
      ["amount", "12.5"],
      ["toAddress", to],
      ["clientTranId", id],
      ["nonce", String(ASKED_AT * 1000)],
      ["user", MAIN],
    ]).toString()
    return requestOf({
      kind: SignatureRequestKind.LAMARGE_MOVE,
      typedData: asterMessage({ msg, chainId: ASTER_SIGN_CHAIN_IDS[Network.MAINNET] }),
      send: { venue: "aster", recipient, amount: (125n * 10n ** 17n).toString() },
    })
  }

  test("signs Aster's send of exactly its amount to one of the user's open sub-accounts", () => {
    const read = signableRequest(asterSend())
    expect(read.ok && read.summary.action).toBe(SignSummaryText.LAMARGE_SEND)
  })

  test("refuses an Aster send to anyone else, to another account than it names, or under a fill's id", () => {
    for (const recipient of [STRANGER, CLOSED_SUB, MAIN]) {
      expect(refusalOf(asterSend({ to: recipient, recipient }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
    expect(refusalOf(asterSend({ to: STRANGER }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    expect(refusalOf(asterSend({ id: "0a".repeat(16) }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses a send's terms on typed data of another kind: a permit, a take's payment", () => {
    for (const typedData of [permit(), payTake()]) {
      for (const venue of ["hyperliquid", "polymarket"]) {
        const asked = requestOf({
          kind: SignatureRequestKind.LAMARGE_MOVE,
          typedData,
          send: { venue, recipient: SUB, amount: "12500000" },
        })
        expect(refusalOf(asked)).toStartWith(SignableRefusal.LAMARGE_CHECK)
      }
    }
  })
})

describe("any request", () => {
  test("is refused when it doesn't say when it was asked: every lifetime it holds is bounded from then", () => {
    const asked = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() })
    expect(signableRequest(asked).ok).toBe(true)
    expect(refusalOf({ ...asked, request: { ...asked.request, createdAt: "not a date" } })).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })
})
