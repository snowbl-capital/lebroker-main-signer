import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { VenueId } from "../../../core/model"
import { MAIN_BYBIT_DEPOSIT_ADDRESS_PROOF_TYPES, SUB_ACCOUNT_PROOF_DOMAIN } from "../../../signer/model"
import { getAddress } from "viem"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import { BybitDepositState } from "../../hooks/bybitKey/useBybitKeyQuery/enums"
import { VenueDepositAddressError } from "./enums"
import { venueDepositAddress } from "./venueDepositAddress"

const MAIN = "0x1111111111111111111111111111111111111111"
const BYBIT = getAddress("0x52c336060d171d2f27baa3d1d3b156fb4a79289c")

/** The executor's answer for Main's Bybit deposit address: `signer`'s `MainBybitDepositAddress` of `BYBIT` for `main`. */
async function bybitBody({
  main,
  signer = main,
  state = BybitDepositState.SIGNED,
}: {
  main: PrivateKeyAccount
  signer?: PrivateKeyAccount
  state?: BybitDepositState
}) {
  const message = {
    owner: "owner-1",
    account: "main-1",
    main: main.address,
    depositAddress: BYBIT,
    chainId: 42161n,
    nonce: 7n,
    deadline: 1n,
  }
  const signature = await signer.signTypedData({
    domain: SUB_ACCOUNT_PROOF_DOMAIN,
    types: MAIN_BYBIT_DEPOSIT_ADDRESS_PROOF_TYPES,
    primaryType: "MainBybitDepositAddress",
    message,
  })
  return {
    deposit: {
      state,
      chainId: 42161,
      read: BYBIT,
      signed: { ...message, chainId: 42161, nonce: "7", deadline: "1", signature, signedAt: "2026-11-08T00:00:00.000Z" },
    },
  }
}

/** The executor answering `body` to the next read. */
function answering({ body }: { body: unknown }) {
  return spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body))
}
/** Lighter's intent address, checksummed, as the read gives it whatever case Lighter answers in. */
const INTENT = getAddress("0x7535aa4a9b6ec46e8ba1fb4e5ca0ad7f0ca28bd0")

describe("venueDepositAddress", () => {
  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore()
  })

  test("reads Lighter's intent address for Main's own address on Arbitrum, from Lighter itself", async () => {
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ intent_address: INTENT.toLowerCase() }))
    expect(await venueDepositAddress({ venue: VenueId.LIGHTER, address: MAIN })).toBe(INTENT)
    const url = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(url.host).toBe("mainnet.zklighter.elliot.ai")
    expect(url.pathname).toBe("/api/v1/createIntentAddress")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      chain_id: "42161",
      from_addr: MAIN,
      amount: "0",
      is_external_deposit: "true",
    })
  })

  test("throws, so that nothing is signed, when Lighter fails, answers something else, or can't be reached", async () => {
    for (const answer of [Response.json({ code: 500 }, { status: 500 }), Response.json({ intent_address: "not an address" })]) {
      spyOn(globalThis, "fetch").mockResolvedValue(answer)
      await expect(venueDepositAddress({ venue: VenueId.LIGHTER, address: MAIN })).rejects.toThrow(VenueDepositAddressError.UNREAD)
    }
    spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(venueDepositAddress({ venue: VenueId.LIGHTER, address: MAIN })).rejects.toThrow(VenueDepositAddressError.UNREAD)
  })

  test("takes Main's Bybit deposit address only as Main signed it, on Arbitrum only, its signature recovered here", async () => {
    const main = privateKeyToAccount(generatePrivateKey())
    const body = await bybitBody({ main })
    const fetched = answering({ body })
    expect(await venueDepositAddress({ venue: VenueId.BYBIT, address: main.address })).toBe(BYBIT)
    expect(new URL(String(fetched.mock.calls[0]?.[0]), "http://localhost").pathname).toEndWith("/v1/bybit-key/deposit-address")
    answering({ body })
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: main.address, chainId: 137 })).rejects.toThrow(
      VenueDepositAddressError.BYBIT_NOT_MAIN,
    )
    // Signed for another wallet than the one signing now: not this Main's word.
    answering({ body })
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: MAIN })).rejects.toThrow(VenueDepositAddressError.BYBIT_NOT_MAIN)
  })

  test("refuses an address the executor names with no Main signature, one Bybit no longer shows, and no answer", async () => {
    const main = privateKeyToAccount(generatePrivateKey())
    // An executor that signed the address with a key of its own.
    answering({ body: await bybitBody({ main, signer: privateKeyToAccount(generatePrivateKey()) }) })
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: main.address })).rejects.toThrow(
      VenueDepositAddressError.BYBIT_NOT_MAIN,
    )
    answering({ body: await bybitBody({ main, state: BybitDepositState.CHANGED }) })
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: main.address })).rejects.toThrow(
      VenueDepositAddressError.BYBIT_CHANGED,
    )
    answering({ body: { deposit: { state: BybitDepositState.NONE, chainId: 42161, read: BYBIT, signed: null } } })
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: main.address })).rejects.toThrow(
      VenueDepositAddressError.BYBIT_UNSIGNED,
    )
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Bybit isn't available for sub-accounts yet." }, { status: 409 }))
    await expect(venueDepositAddress({ venue: VenueId.BYBIT, address: main.address })).rejects.toThrow(VenueDepositAddressError.UNREAD)
  })

  test("gives GMX's as the account's own address on Arbitrum, read from nowhere: the account is the wallet", async () => {
    const fetched = spyOn(globalThis, "fetch")
    const lower = "0x7535aa4a9b6ec46e8ba1fb4e5ca0ad7f0ca28bd0"
    expect(await venueDepositAddress({ venue: VenueId.GMX, address: lower })).toBe(getAddress(lower))
    await expect(venueDepositAddress({ venue: VenueId.GMX, address: MAIN, chainId: 1 })).rejects.toThrow(VenueDepositAddressError.NONE)
    expect(fetched).not.toHaveBeenCalled()
  })

  test("reads nothing for a venue leneutre opens no account on with a withdrawal", async () => {
    const fetched = spyOn(globalThis, "fetch")
    await expect(venueDepositAddress({ venue: VenueId.ASTER, address: MAIN })).rejects.toThrow(VenueDepositAddressError.NONE)
    expect(fetched).not.toHaveBeenCalled()
  })
})
