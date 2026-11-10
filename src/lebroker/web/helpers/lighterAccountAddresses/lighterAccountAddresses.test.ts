import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { getAddress } from "viem"
import { LighterAccountAddressesError } from "./enums"
import { lighterAccountAddresses } from "./lighterAccountAddresses"

const MAIN = getAddress("0x1111111111111111111111111111111111111111")
const SUB = getAddress("0x2222222222222222222222222222222222222222")

/** Lighter's public read of one account, by its index, in the case Lighter answers in. */
function answer({ index, owner }: { index: number; owner: string }) {
  return Response.json({ code: 200, total: 1, accounts: [{ index, l1_address: owner.toLowerCase(), account_type: 0 }] })
}

describe("lighterAccountAddresses", () => {
  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore()
  })

  test("reads the owner of each account a transfer names, by its index, from Lighter itself, once each", async () => {
    // Main's account at 42, the sub-account's at 731, each read in turn.
    const fetched = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(answer({ index: 42, owner: MAIN }))
      .mockResolvedValueOnce(answer({ index: 731, owner: SUB }))
    expect(await lighterAccountAddresses({ indexes: [42, 731, 42] })).toEqual(
      new Map([
        [42, MAIN],
        [731, SUB],
      ]),
    )
    expect(fetched).toHaveBeenCalledTimes(2)
    const url = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(url.host).toBe("mainnet.zklighter.elliot.ai")
    expect(url.pathname).toBe("/api/v1/account")
    expect(Object.fromEntries(url.searchParams)).toEqual({ by: "index", value: "42" })
  })

  test("throws, so that nothing is signed, when Lighter fails, answers another account, or can't be reached", async () => {
    for (const read of [Response.json({ code: 500 }, { status: 500 }), answer({ index: 43, owner: MAIN })]) {
      spyOn(globalThis, "fetch").mockResolvedValue(read)
      await expect(lighterAccountAddresses({ indexes: [42] })).rejects.toThrow(LighterAccountAddressesError.UNREAD)
    }
    spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(lighterAccountAddresses({ indexes: [42] })).rejects.toThrow(LighterAccountAddressesError.UNREAD)
  })
})
