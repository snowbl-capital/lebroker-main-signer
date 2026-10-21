import { describe, expect, test } from "bun:test"
import { GAS_RESERVE_DEPLOYMENTS, GAS_RESERVE_PAYMENT_MAX_USD } from "./constants"
import { pinnedGasReserve } from "./utils"

describe("the gas reserve Main's wallet pays (D51, phase 6)", () => {
  test("is paid at most the signer's own hard cap on a payment, $20", () => {
    expect(GAS_RESERVE_PAYMENT_MAX_USD).toBe(20)
  })

  test("is pinned for dev only, by the origin its app is served from; production and any other deployment pin none", () => {
    expect(pinnedGasReserve({ appOrigin: "https://lebroker.dev.lamarge.trade" })).toBe("0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F")
    expect(pinnedGasReserve({ appOrigin: "https://lebroker.lamarge.trade" })).toBeNull()
    expect(pinnedGasReserve({ appOrigin: "http://localhost:5175" })).toBeNull()
    expect(GAS_RESERVE_DEPLOYMENTS.map(pin => pin.appOrigin)).toEqual([
      "https://lebroker.dev.lamarge.trade",
      "https://lebroker.lamarge.trade",
    ])
  })
})
