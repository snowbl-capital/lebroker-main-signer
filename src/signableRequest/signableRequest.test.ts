import { describe, expect, test } from "bun:test"
import { CHAINS, ESCROW, TAKER_API_KEY, UNLIMITED_ALLOWANCE } from "@lamarge/sdk/protocol"
import type { Address } from "viem"
import { LIGHTER_KEY_INDEX, SignatureRequestKind } from "../lebroker/accounts/model"
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
import { SignableRefusal, SignSummaryLabel } from "./enums"
import { signableRequest } from "./signableRequest"
import {
  AGENT,
  ASKED_AT,
  CLOSED_SUB,
  MAIN,
  MAIN_ACCOUNT_ID,
  STRANGER,
  SUB,
  USER_ID,
  registrationMessage,
  requestOf,
} from "./testing/fixtures"

const DAY_MS = 24 * 60 * 60 * 1000

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

function sendAsset({ destination, signatureChainId = 42161 }: { destination: Address; signatureChainId?: number }) {
  return hyperliquidSendAssetRequest({
    destination,
    sourceDex: HYPERLIQUID_SEND_DEX,
    destinationDex: HYPERLIQUID_SEND_DEX,
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

  test("pays into LaMarge's Aster vault, never elsewhere", () => {
    const vault = CHAINS.aster?.escrow ?? ""
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: asterTransfer({ to: vault }) })).ok).toBe(true)
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, typedData: asterTransfer({ to: SUB }) }))).toBe(
      SignableRefusal.NOT_YOUR_ACCOUNT,
    )
  })

  test("signs in on LaMarge's app and registers LaMarge's Lighter key, and nothing else in words", () => {
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signIn({ host: "app.lamarge.trade" }) })).ok).toBe(
      true,
    )
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: signIn({ host: "app.evil.example" }) }))).toBe(
      SignableRefusal.OPAQUE,
    )
    const key = registrationMessage({ accountIndex: 42, apiKeyIndex: TAKER_API_KEY })
    expect(signableRequest(requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: key })).ok).toBe(true)
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
