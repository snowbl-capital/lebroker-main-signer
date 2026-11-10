import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { polymarketDepositWalletOf } from "../../../venues/model"
import { getAddress } from "viem"
import { PolymarketBridgeAddressError } from "./enums"
import { polymarketBridgeAddress } from "./polymarketBridgeAddress"

const MAIN = "0x1111111111111111111111111111111111111111"
const BYBIT = "0x52c336060d171d2f27baa3d1d3b156fb4a79289c"
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
/** The bridge's answer, as recorded on 8 November 2026. */
const PAY_TO = "0x23C39b368a0480C3bfb8AA49960a0DdB26865953"

describe("polymarketBridgeAddress", () => {
  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore()
  })

  test("asks Polymarket's bridge itself for Main's own Deposit Wallet, derived here, paying the recipient", async () => {
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ address: { evm: PAY_TO.toLowerCase() } }))
    expect(await polymarketBridgeAddress({ main: MAIN, recipient: BYBIT, chainId: 42161, token: USDC })).toBe(getAddress(PAY_TO))
    expect(String(fetched.mock.calls[0]?.[0])).toBe("https://bridge.polymarket.com/withdraw")
    const sent: unknown = JSON.parse(String(fetched.mock.calls[0]?.[1]?.body))
    expect(sent).toEqual({
      address: polymarketDepositWalletOf({ owner: MAIN }),
      toChainId: "42161",
      toTokenAddress: USDC,
      recipientAddr: BYBIT,
    })
  })

  test("throws, so that nothing is signed, when the bridge fails or answers no address", async () => {
    for (const answer of [Response.json({}, { status: 500 }), Response.json({ address: { evm: "nope" } })]) {
      spyOn(globalThis, "fetch").mockResolvedValue(answer)
      await expect(polymarketBridgeAddress({ main: MAIN, recipient: BYBIT, chainId: 42161, token: USDC })).rejects.toThrow(
        PolymarketBridgeAddressError.UNREAD,
      )
    }
  })
})
