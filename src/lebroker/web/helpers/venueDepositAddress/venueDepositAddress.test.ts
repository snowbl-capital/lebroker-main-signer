import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { VenueId } from "../../../core/model"
import { getAddress } from "viem"
import { VenueDepositAddressError } from "./enums"
import { venueDepositAddress } from "./venueDepositAddress"

const MAIN = "0x1111111111111111111111111111111111111111"
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

  test("reads nothing for a venue lebroker opens no account on with a withdrawal", async () => {
    const fetched = spyOn(globalThis, "fetch")
    await expect(venueDepositAddress({ venue: VenueId.ASTER, address: MAIN })).rejects.toThrow(VenueDepositAddressError.NONE)
    expect(fetched).not.toHaveBeenCalled()
  })
})
