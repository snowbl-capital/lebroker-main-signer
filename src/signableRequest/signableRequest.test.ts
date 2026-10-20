import { describe, expect, test } from "bun:test"
import {
  CHAINS,
  COLLATERAL_ROUTE,
  ESCROW,
  TAKER_API_KEY,
  UNLIMITED_ALLOWANCE,
  USDC_ASSET,
  fillMemo,
  fromHex,
  transferMessage,
} from "@lamarge/sdk/protocol"
import type { Address } from "viem"
import {
  LIGHTER_KEY_INDEX,
  SignatureRequestKind,
  SignatureRequestReason,
  type LaMargeRequestContext,
  type LaMargeTake,
} from "../lebroker/accounts/model"
import { Network, VenueId } from "../lebroker/core/model"
import { MAIN_LIGHTER_ACCOUNT_PROOF_TYPES, SUB_ACCOUNT_PROOF_DOMAIN } from "../lebroker/signer/model"
import {
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_CHAIN_IDS,
  ASTER_SIGN_DOMAIN,
  HYPERLIQUID_AGENT_NAME,
  HYPERLIQUID_SEND_DEX,
  HYPERLIQUID_USDC,
} from "../lebroker/venues/model"
import {
  asterAgentApprovalRequest,
  hyperliquidApproveAgentRequest,
  hyperliquidSendAssetRequest,
  hyperliquidWithdrawRequest,
  polymarketCreateProxyTypedData,
} from "./testing/builders/builders"
import { AsterAgentKind } from "./testing/builders/enums"
import { SignableRefusal, SignStarter, SignSummaryLabel, SignSummaryText } from "./enums"
import { signableRequest } from "./signableRequest"
import {
  AGENT,
  ASKED_AT,
  CLOSED_SUB,
  LAMARGE_PRODUCTION,
  MAIN,
  MAIN_ACCOUNT_ID,
  STRANGER,
  SUB,
  USER_ID,
  registrationMessage,
  requestOf,
} from "./testing/fixtures"

const DAY_MS = 24 * 60 * 60 * 1000

/** LaMarge's dev deployment, as the executor names it in a request. */
const LAMARGE_DEV = { appOrigin: "https://app.dev.lamarge.trade" }

function refusalOf(props: ReturnType<typeof requestOf>): string | null {
  const read = signableRequest(props)
  return read.ok ? null : read.refusal
}

function hyperliquidApproval({ signatureChainId = 42161, validDays = 180 }: { signatureChainId?: number; validDays?: number } = {}) {
  return hyperliquidApproveAgentRequest({
    agentAddress: AGENT,
    name: HYPERLIQUID_AGENT_NAME,
    validUntil: ASKED_AT + validDays * DAY_MS,
    nonce: ASKED_AT,
    network: Network.MAINNET,
    signatureChainId,
  }).typedData
}

function asterApproval() {
  return asterAgentApprovalRequest({
    kind: AsterAgentKind.TRADING,
    user: MAIN,
    agent: AGENT,
    nonce: String(ASKED_AT * 1000),
    expiry: ASKED_AT + 180 * DAY_MS,
    now: ASKED_AT,
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
        ...fill,
      },
    ],
  }
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
}: { message?: string; take?: LaMargeTake | null; kind?: SignatureRequestKind; reason?: SignatureRequestReason } = {}) {
  return requestOf({
    kind,
    venue: kind === SignatureRequestKind.LAMARGE_MOVE ? null : VenueId.LIGHTER,
    message,
    ...(take === null ? {} : { take }),
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
  test("signs lebroker's Hyperliquid agent on the wallet's chain or Arbitrum, and says what it approves", () => {
    const read = signableRequest(requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() }))
    expect(read.ok && read.summary.chainId).toBe(42161)
    const onWallet = signableRequest(
      requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval({ signatureChainId: 10 }), walletChainId: 10 }),
    )
    expect(onWallet.ok && onWallet.summary.chainId).toBe(10)
  })

  test("refuses a chain neither the wallet shows nor Hyperliquid's own: the wallet is never switched to it", () => {
    const props = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval({ signatureChainId: 56 }), walletChainId: 1 })
    expect(refusalOf(props)).toBe(SignableRefusal.UNKNOWN_CHAIN)
  })

  test("refuses another agent's name, an approval past 180 days, and a domain with a field more", () => {
    const renamed = requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval() })
    if (renamed.request.payload.kind === "typed-data") {
      renamed.request.payload.typedData.message.agentName = "attacker valid_until 1"
    }
    expect(refusalOf(renamed)).toBe(SignableRefusal.NOT_LEBROKER_AGENT)
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

  test("signs Aster's trading agent, never one that withdraws, and never for another wallet", () => {
    expect(signableRequest(requestOf({ venue: VenueId.ASTER, typedData: asterApproval() })).ok).toBe(true)
    const typed = asterApproval()
    const withdrawing = { ...typed, message: { msg: typed.message.msg.replace("canWithdraw=false", "canWithdraw=true") } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: withdrawing }))).toBe(SignableRefusal.WITHDRAW_PERMISSION)
    const other = { ...typed, message: { msg: typed.message.msg.replace(`user=${MAIN}`, `user=${STRANGER}`) } }
    expect(refusalOf(requestOf({ venue: VenueId.ASTER, typedData: other }))).toBe(SignableRefusal.OTHER_MAIN)
  })

  test("signs Polymarket's proxy for a week, not a month", () => {
    const week = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT + 7 * DAY_MS, salt: 1, ts: ASKED_AT })
    expect(signableRequest(requestOf({ venue: VenueId.POLYMARKET_PERPS, typedData: week })).ok).toBe(true)
    const month = polymarketCreateProxyTypedData({ proxy: AGENT, expiry: ASKED_AT + 30 * DAY_MS, salt: 1, ts: ASKED_AT })
    expect(refusalOf(requestOf({ venue: VenueId.POLYMARKET_PERPS, typedData: month }))).toBe(SignableRefusal.TOO_LONG)
  })

  test("signs Lighter's proof for Main's own account, and its key's registration at lebroker's indexes only, 200 to 253", () => {
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
      signableRequest(requestOf({ venue: VenueId.LIGHTER, message: registrationMessage({ accountIndex: 42, apiKeyIndex: 253 }) })).ok,
    ).toBe(true)
    // LaMarge's index, never lebroker's: a setup there would replace LaMarge's key.
    const lamarge = registrationMessage({ accountIndex: 42, apiKeyIndex: TAKER_API_KEY })
    expect(refusalOf(requestOf({ venue: VenueId.LIGHTER, message: lamarge }))).toBe(SignableRefusal.NOT_LEBROKER_KEY)
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

  test("refuses a destination that isn't one of the user's open sub-accounts", () => {
    for (const destination of [STRANGER, CLOSED_SUB, MAIN]) {
      const props = requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID, typedData: sendAsset({ destination }) })
      expect(refusalOf(props)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    }
    const aster = requestOf({ kind: SignatureRequestKind.TRANSFER, venue: VenueId.ASTER, typedData: asterTransfer({ to: STRANGER }) })
    expect(refusalOf(aster)).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
  })

  test("refuses a third party even with a LaMarge take beside it: only a LaMarge move pays a maker", () => {
    expect(refusalOf(asterTakeRequest({ kind: SignatureRequestKind.TRANSFER }))).toBe(SignableRefusal.NOT_YOUR_ACCOUNT)
    const withdrawal = asterTakeRequest({ kind: SignatureRequestKind.WITHDRAWAL })
    expect(refusalOf({ ...withdrawal, request: { ...withdrawal.request, venue: VenueId.ASTER } })).toBe(SignableRefusal.UNKNOWN_SHAPE)
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
})

describe("a LaMarge move", () => {
  test("signs a permit only to LaMarge's pinned escrow", () => {
    const read = signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit() }))
    expect(read.ok && read.summary.chainId).toBe(999)
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: permit({ spender: STRANGER }) }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
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

  test("pays a take inside Aster to the maker the take names, and says what it signs and who started the move", () => {
    const read = signableRequest(asterTakeRequest())
    expect(read.ok && read.summary).toEqual({
      action: SignSummaryText.LAMARGE_ASTER_TAKE,
      lines: [
        { label: SignSummaryLabel.AMOUNT, value: "62.13" },
        { label: SignSummaryLabel.MAKER, value: "0x651f…5C09" },
        { label: SignSummaryLabel.STARTED_BY, value: SignStarter.USER },
      ],
      chainId: ASTER_SIGN_CHAIN_IDS[Network.MAINNET],
    })
    const keeper = signableRequest(asterTakeRequest({ reason: SignatureRequestReason.MARGIN_KEEPER }))
    expect(keeper.ok && keeper.summary.lines.at(-1)).toEqual({ label: SignSummaryLabel.STARTED_BY, value: SignStarter.MARGIN_KEEPER })
  })

  test("refuses a payment inside Aster that names no take, LaMarge's Aster vault included", () => {
    expect(refusalOf(asterTakeRequest({ take: null }))).toBe(SignableRefusal.NO_TAKE)
    const vault = TAKE_MESSAGE.replace(TAKE_MAKER, CHAINS.aster?.escrow ?? "")
    expect(refusalOf(asterTakeRequest({ msg: vault, take: null }))).toBe(SignableRefusal.NO_TAKE)
  })

  test("refuses a payment inside Aster to another address than the take's maker recipient", () => {
    for (const to of [STRANGER, CHAINS.aster?.escrow ?? "", TAKE_MAIN]) {
      expect(refusalOf(asterTakeRequest({ msg: TAKE_MESSAGE.replace(TAKE_MAKER, to) }))).toStartWith(SignableRefusal.LAMARGE_CHECK)
    }
    // A take that names another maker than the one the transfer pays.
    expect(refusalOf(asterTakeRequest({ take: asterTake({ fill: { maker_recipient: STRANGER } }) }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
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

  test("refuses a payment inside Lighter that differs from the take's fill: its amount, its id, its fee, its payer, its taker", () => {
    const refused = [
      lighterTakeRequest({ message: lighterTransferText({ amount: 2_001_301n }) }),
      lighterTakeRequest({ message: lighterTransferText({ amount: 2_001_299n }) }),
      lighterTakeRequest({ message: lighterTransferText({ fill: TAKE_FILL_ID }) }),
      lighterTakeRequest({ message: lighterTransferText({ fee: 1_000_001n }) }),
      lighterTakeRequest({ take: lighterTake({ fill: { payer: STRANGER } }) }),
      lighterTakeRequest({ take: lighterTake({ fill: { taker_recipient: STRANGER } }) }),
      lighterTakeRequest({ take: lighterTake({ fill: { pay_by: new Date(ASKED_AT - 1000).toISOString() } }) }),
      lighterTakeRequest({ take: lighterTake({ fill: { from_venue: "aster" } }) }),
    ]
    for (const request of refused) {
      expect(refusalOf(request)).toStartWith(SignableRefusal.LAMARGE_CHECK)
    }
    const twice = lighterTake()
    expect(refusalOf(lighterTakeRequest({ take: { ...twice, fills: [...twice.fills, ...twice.fills] } }))).toStartWith(
      SignableRefusal.LAMARGE_CHECK,
    )
    // Main's wallet is the take's payer and taker, never another's.
    expect(refusalOf({ ...lighterTakeRequest(), user: { id: USER_ID, address: MAIN } })).toStartWith(SignableRefusal.LAMARGE_CHECK)
  })

  test("refuses another Lighter message than LaMarge's for a take: another key, asset, route or chain, or written otherwise", () => {
    const pinned = [
      lighterTransferText({ apiKey: 4 }),
      lighterTransferText({ asset: 1 }),
      lighterTransferText({ fromRoute: 1 }),
      lighterTransferText({ chainId: 300 }),
    ]
    for (const message of pinned) {
      expect(refusalOf(lighterTakeRequest({ message }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    }
    const unread = [
      LIGHTER_TAKE_MESSAGE.toUpperCase(),
      LIGHTER_TAKE_MESSAGE.replace("0x00000000001e8994", "0x1e8994"),
      `${LIGHTER_TAKE_MESSAGE}\n`,
      LIGHTER_TAKE_MESSAGE.replace("Only sign this message for a trusted client!", ""),
    ]
    for (const message of unread) {
      expect(refusalOf(lighterTakeRequest({ message }))).toBe(SignableRefusal.OPAQUE)
    }
  })

  test("refuses Lighter's message for a take asked as anything but a LaMarge move: a transfer, a withdrawal, a setup", () => {
    expect(refusalOf(lighterTakeRequest({ kind: SignatureRequestKind.TRANSFER }))).toBe(SignableRefusal.OPAQUE)
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

describe("any request", () => {
  test("is refused when it's for another account than Main", () => {
    expect(refusalOf(requestOf({ venue: VenueId.HYPERLIQUID, typedData: hyperliquidApproval(), accountId: "account-sub-1" }))).toBe(
      SignableRefusal.OTHER_ACCOUNT,
    )
  })
})
