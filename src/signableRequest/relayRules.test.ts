import { describe, expect, test } from "bun:test"
import { bridgeSendAsset } from "@lamarge/sdk/protocol"
import { SignatureRequestKind, SignaturePayloadKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { RelayRefusal } from "../relayDecline/enums"
import { signableRequest } from "./signableRequest"
import { ASKED_AT, requestOf } from "./testing/fixtures"
import type { SignableRequestProps } from "./types"

/** Any bridge the service names beside a request: what it is never matters here, it's declined. */
const BRIDGE = { terms: {}, amountIn: "100000000", order: {} }

function refusalOf(props: SignableRequestProps): string | null {
  const read = signableRequest(props)
  return read.ok ? null : read.refusal
}

describe("a LaMarge move's Relay bridge", () => {
  test("its HyperCore send is declined here, its reason said, for the browser to sign", () => {
    const props = requestOf({
      kind: SignatureRequestKind.LAMARGE_MOVE,
      venue: VenueId.HYPERLIQUID,
      typedData: bridgeSendAsset(1n, BigInt(ASKED_AT)),
    })
    const payload = props.request.payload
    if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
      throw new Error("not typed data")
    }
    expect(refusalOf({ ...props, request: { ...props.request, payload: { ...payload, bridge: BRIDGE } } })).toBe(RelayRefusal.NOT_HERE)
  })

  test("its wallet transactions are declined too", () => {
    const props = requestOf({ kind: SignatureRequestKind.LAMARGE_MOVE, message: "transaction" })
    const transaction = { chainId: 42161, to: "0x4cd00e387622c35bddb9b4c962c136462338bc31", data: "0x095ea7b3" } as const
    const payload = { kind: SignaturePayloadKind.TRANSACTION, transaction, bridge: BRIDGE } as const
    expect(refusalOf({ ...props, request: { ...props.request, payload } })).toBe(RelayRefusal.NOT_HERE)
  })
})
