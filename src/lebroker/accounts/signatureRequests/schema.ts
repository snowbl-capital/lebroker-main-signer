import { z } from "zod"
import { VenueId } from "../../core/model"
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
  lighter: z.object({ from_account_index: z.number().int().nonnegative(), to_account_index: z.number().int().nonnegative() }).optional(),
})

/** The LaMarge deployment a request is for (`LaMargeRequestContext`). */
const laMargeRequestContext = z.object({
  appOrigin: z.string(),
  lighterAccountIndex: z.number().int().nonnegative().optional(),
})

/** What a payment to lebroker's gas reserve buys (`GasPurchaseContext`). */
const gasPurchaseContext = z.object({ chainId: z.number().int().positive() })

const signaturePayload = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(SignaturePayloadKind.TYPED_DATA),
    typedData: typedDataPayload,
    take: laMargeTake.optional(),
    lamarge: laMargeRequestContext.optional(),
    gas: gasPurchaseContext.optional(),
    depositVenue: z.enum(VenueId).optional(),
  }),
  z.object({
    kind: z.literal(SignaturePayloadKind.PERSONAL_MESSAGE),
    message: z.string(),
    take: laMargeTake.optional(),
    lamarge: laMargeRequestContext.optional(),
  }),
])

export { laMargeRequestContext, laMargeTake, signaturePayload, typedDataPayload }
