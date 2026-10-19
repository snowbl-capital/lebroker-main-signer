import type { SignaturePayloadKind } from "./enums"

/** EIP-712 typed data as a browser wallet's `eth_signTypedData_v4` takes it: integers as decimal strings. */
type TypedDataPayload = {
  domain: Record<string, unknown>
  types: Record<string, readonly { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
}

/** What Main's wallet signs for a request. */
type SignaturePayload =
  { kind: SignaturePayloadKind.TYPED_DATA; typedData: TypedDataPayload } | { kind: SignaturePayloadKind.PERSONAL_MESSAGE; message: string }

export type { SignaturePayload, TypedDataPayload }
