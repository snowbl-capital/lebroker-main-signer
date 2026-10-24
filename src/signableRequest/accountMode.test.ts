import { describe, expect, test } from "bun:test"
import { SignatureRequestKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { HYPERLIQUID_USER_SET_ABSTRACTION_TYPES, HYPERLIQUID_USER_SIGNED_DOMAIN } from "../lebroker/venues/model"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import { signableRequest } from "./signableRequest"
import { ASKED_AT, MAIN, STRANGER, SUB, requestOf } from "./testing/fixtures"

/** `userSetAbstraction` as Hyperliquid's docs write it for Main, with any of its parts changed. */
function unify({
  message = {},
  chainId = 42161,
  venue = VenueId.HYPERLIQUID,
  kind = SignatureRequestKind.ACCOUNT_MODE,
  typedData = {},
  accountId,
  askedAt = ASKED_AT,
  now = ASKED_AT,
}: {
  message?: Record<string, unknown>
  chainId?: number
  venue?: string | null
  kind?: SignatureRequestKind
  /** Any part of the typed data replaced whole: its domain, types, primary type or message. */
  typedData?: Record<string, unknown>
  accountId?: string
  /** When the service says it asked, and when this signer reads it. */
  askedAt?: number
  now?: number
} = {}) {
  return requestOf({
    kind,
    venue,
    askedAt,
    now,
    ...(accountId === undefined ? {} : { accountId }),
    typedData: {
      domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId },
      types: HYPERLIQUID_USER_SET_ABSTRACTION_TYPES,
      primaryType: "HyperliquidTransaction:UserSetAbstraction",
      message: { hyperliquidChain: "Mainnet", user: MAIN.toLowerCase(), abstraction: "unifiedAccount", nonce: ASKED_AT, ...message },
      ...typedData,
    },
  })
}

const FIELDS = HYPERLIQUID_USER_SET_ABSTRACTION_TYPES["HyperliquidTransaction:UserSetAbstraction"]

function refusalOf(props: ReturnType<typeof requestOf>): string | null {
  const read = signableRequest(props)
  return read.ok ? null : read.refusal
}

describe("Main's Hyperliquid account switched to unified mode (D66)", () => {
  test("is signed for Main's own address, on mainnet, and says plainly what it does", () => {
    expect(signableRequest(unify())).toEqual({
      ok: true,
      summary: {
        action: SignSummaryText.UNIFY_HYPERLIQUID,
        lines: [
          { label: SignSummaryLabel.ACCOUNT, value: "0x1111…1111" },
          { label: SignSummaryLabel.CHAIN, value: "42161" },
        ],
        chainId: 42161,
      },
    })
    expect(signableRequest(unify({ message: { user: MAIN } })).ok).toBe(true)
  })

  test("is signed on the wallet's own chain, or one lebroker signs on, only", () => {
    expect(refusalOf(unify({ chainId: 10 }))).toBe(SignableRefusal.UNKNOWN_CHAIN)
  })

  test("is never signed for another mode", () => {
    for (const abstraction of ["portfolioMargin", "disabled", "default", "UnifiedAccount", ""]) {
      expect(refusalOf(unify({ message: { abstraction } }))).toBe(SignableRefusal.NOT_UNIFIED)
    }
    expect(refusalOf(unify({ message: { abstraction: 1 } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("is never signed for another account: a sub-account, a stranger, none", () => {
    for (const user of [SUB, STRANGER, "0x0000000000000000000000000000000000000000", ""]) {
      expect(refusalOf(unify({ message: { user } }))).toBe(SignableRefusal.OTHER_MAIN)
    }
  })

  test("is never signed on Hyperliquid's testnet, nor with a field more", () => {
    expect(refusalOf(unify({ message: { hyperliquidChain: "Testnet" } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(unify({ message: { time: ASKED_AT } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("is asked only as Main's account mode, on Hyperliquid", () => {
    expect(refusalOf(unify({ venue: VenueId.ASTER }))).toBe(SignableRefusal.UNKNOWN_VENUE)
    expect(refusalOf(unify({ kind: SignatureRequestKind.VENUE_SETUP }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    expect(refusalOf(unify({ kind: SignatureRequestKind.TRANSFER }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
  })

  test("is signed only as Hyperliquid writes it: its primary type, its fields in their order, each of them", () => {
    const withoutNonce = { hyperliquidChain: "Mainnet", user: MAIN.toLowerCase(), abstraction: "unifiedAccount" }
    const requests = [
      unify({ typedData: { primaryType: "HyperliquidTransaction:SendAsset" } }),
      unify({ typedData: { types: { "HyperliquidTransaction:UserSetAbstraction": [...FIELDS].reverse() } } }),
      unify({ typedData: { message: withoutNonce } }),
    ]
    for (const request of requests) {
      expect(refusalOf(request)).toBe(SignableRefusal.UNKNOWN_SHAPE)
    }
  })

  test("is signed only in Hyperliquid's user-signed domain", () => {
    for (const domain of [{ name: "Exchange" }, { version: "2" }, { verifyingContract: STRANGER }]) {
      const request = unify({ typedData: { domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId: 42161, ...domain } } })
      expect(refusalOf(request)).toBe(SignableRefusal.UNKNOWN_SHAPE)
    }
  })

  test("is signed with the nonce lebroker asked it with, never one further ahead", () => {
    for (const nonce of ["abc", -1, 1.5]) {
      expect(refusalOf(unify({ message: { nonce } }))).toBe(SignableRefusal.UNKNOWN_SHAPE)
    }
    expect(signableRequest(unify({ message: { nonce: ASKED_AT + 30 * 60 * 1000 } })).ok).toBe(true)
    expect(refusalOf(unify({ message: { nonce: ASKED_AT + 2 * 60 * 60 * 1000 } }))).toBe(SignableRefusal.TOO_LONG)
  })

  test("is held to this signer's own clock too: a request the service dates ahead lifts nothing", () => {
    const ahead = ASKED_AT + 24 * 60 * 60 * 1000
    expect(refusalOf(unify({ askedAt: ahead, now: ASKED_AT, message: { nonce: ahead } }))).toBe(SignableRefusal.TOO_LONG)
  })

  test("is never signed asked as anything else, nor for no venue", () => {
    for (const kind of [SignatureRequestKind.WITHDRAWAL, SignatureRequestKind.GAS_PURCHASE, SignatureRequestKind.LAMARGE_MOVE]) {
      expect(refusalOf(unify({ kind }))).not.toBeNull()
    }
    expect(refusalOf(unify({ venue: null }))).not.toBeNull()
  })

  test("is signed only as a typed request, for Main's own account", () => {
    expect(refusalOf(requestOf({ kind: SignatureRequestKind.ACCOUNT_MODE, venue: VenueId.HYPERLIQUID, message: "unify" }))).toBe(
      SignableRefusal.OPAQUE,
    )
    expect(refusalOf(unify({ accountId: "account-sub-1" }))).toBe(SignableRefusal.OTHER_ACCOUNT)
  })
})
