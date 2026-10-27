import { describe, expect, test } from "bun:test"
import { GAS_RESERVE_DEPLOYMENTS, GAS_RESERVE_PAYMENT_MAX_USD } from "./constants"
import { pinnedGasReserve } from "./utils"

describe("the gas reserve Main's wallet pays", () => {
  test("is paid at most the signer's own hard cap on a payment, $20", () => {
    expect(GAS_RESERVE_PAYMENT_MAX_USD).toBe(20)
  })

  test("is pinned for the live deployment only, under both its names; any other deployment pins none", () => {
    for (const appOrigin of ["https://app.leneutre.trade", "https://lebroker.dev.lamarge.trade"]) {
      expect(pinnedGasReserve({ appOrigin })).toBe("0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F")
    }
    for (const appOrigin of [
      "https://app.dev.leneutre.trade",
      "https://lebroker.lamarge.trade",
      "https://leneutre.trade",
      "http://localhost:5175",
    ]) {
      expect(pinnedGasReserve({ appOrigin })).toBeNull()
    }
    expect(GAS_RESERVE_DEPLOYMENTS.map(pin => pin.appOrigin)).toEqual([
      "https://app.leneutre.trade",
      "https://lebroker.dev.lamarge.trade",
      "https://app.dev.leneutre.trade",
    ])
  })
})
