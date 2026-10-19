import { z } from "zod"
import { SignaturePayloadKind } from "../enums"

const typedDataPayload = z.object({
  domain: z.record(z.string(), z.unknown()),
  types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }))),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
})

const signaturePayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(SignaturePayloadKind.TYPED_DATA), typedData: typedDataPayload }),
  z.object({ kind: z.literal(SignaturePayloadKind.PERSONAL_MESSAGE), message: z.string() }),
])

export { signaturePayload, typedDataPayload }
