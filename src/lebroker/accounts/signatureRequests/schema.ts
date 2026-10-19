import { z } from "zod"
import { SignaturePayloadKind } from "../enums"

const typedDataPayload = z.object({
  domain: z.record(z.string(), z.unknown()),
  types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }))),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
})

/** A LaMarge take as its API answers it, in its own field names (`LaMargeTake`). */
const laMargeTake = z.object({
  input: z.object({
    from: z.string(),
    to: z.string(),
    amount_in: z.string(),
    min_out: z.string(),
  }),
  fills: z.array(
    z.object({
      id: z.string(),
      order_id: z.string(),
      sequence: z.number().int(),
      role: z.string(),
      from_venue: z.string(),
      to_venue: z.string(),
      amount_in: z.string(),
      amount_out: z.string(),
      payer: z.string(),
      maker_recipient: z.string(),
      taker_recipient: z.string(),
      swap_id: z.string(),
      hashlock: z.string(),
      pay_by: z.string(),
      t1: z.string(),
      t2: z.string(),
      delivery_to: z.string().nullable().optional(),
    }),
  ),
})

const signaturePayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(SignaturePayloadKind.TYPED_DATA), typedData: typedDataPayload, take: laMargeTake.optional() }),
  z.object({ kind: z.literal(SignaturePayloadKind.PERSONAL_MESSAGE), message: z.string() }),
])

export { laMargeTake, signaturePayload, typedDataPayload }
