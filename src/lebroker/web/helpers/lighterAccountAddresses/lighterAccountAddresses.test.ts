import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { getAddress } from "viem"
import { LighterAccountAddressesError } from "./enums"
import { lighterAccountAddresses } from "./lighterAccountAddresses"

const MAIN = getAddress("0x1111111111111111111111111111111111111111")

/** Lighter's public read of one account, by its index, in the case Lighter answers in. */
function answer({ index, owner }: { index: number; owner: string }) {
  return Response.json({ code: 200, total: 1, accounts: [{ index, l1_address: owner.toLowerCase(), account_type: 0 }] })
}

describe("lighterAccountAddresses", () => {
  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore()
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
