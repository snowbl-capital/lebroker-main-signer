import { MAX_FEE_BPS } from "@lamarge/sdk/protocol"
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
    /** The most taker fee the take accepts, in basis points: never above LaMarge's most (`MAX_FEE_BPS`). */
    max_fee_bps: z.number().int().nonnegative().max(MAX_FEE_BPS).optional(),
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
      taker_fee: z.string().optional(),
    }),
  ),
  lighter: z.object({ from_account_index: z.number().int().nonnegative(), to_account_index: z.number().int().nonnegative() }).optional(),
})

/** A LaMarge send to another of the user's accounts on the same venue (`LaMargeSend`). */
const laMargeSend = z.object({
  venue: z.string(),
  recipient: z.string(),
  amount: z.string().regex(/^[0-9]+$/),
  op: z
    .object({
      type: z.string(),
      args: z.object({ account: z.string(), token: z.string(), amount: z.string(), to: z.string() }),
    })
    .optional(),
})

/** The LaMarge deployment a request is for (`LaMargeRequestContext`). */
const laMargeRequestContext = z.object({
  appOrigin: z.string(),
  lighterAccountIndex: z.number().int().nonnegative().optional(),
})

/** LaMarge's attestation of a request, as LaMarge sent it (`LaMargeAttestation`): verified by the signing side. */
const laMargeAttestation = z.object({ signature: z.string(), terms: z.record(z.string(), z.unknown()).optional() })

/** A request's place in a chain of signatures (`SignatureStep`). */
const signatureStep = z.object({ index: z.number().int().positive(), total: z.number().int().positive() })

/**
 * Main's approval of lebroker's GMX subaccount, beside its typed data: the key it lets trade Main's GMX account, until
 * when (ms since 1970), how many order actions it may take, and the chain Main's wallet signs on (Arbitrum's, the
 * domain's).
 */
const gmxSubaccountApproval = z.object({
  subaccount: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  expiresAt: z.number().int().nonnegative(),
  maxAllowedCount: z.number().int().positive(),
  chainId: z.number().int().positive(),
})

/** Main's USDC permit for GMX's Router, beside its typed data: the spender it names, and the chain it's signed on. */
const gmxUsdcPermit = z.object({ spender: z.string().regex(/^0x[0-9a-fA-F]{40}$/), chainId: z.number().int().positive() })

const signaturePayload = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(SignaturePayloadKind.TRANSACTION),
    transaction: z.object({
      chainId: z.number().int().positive(),
      to: z.templateLiteral(["0x", z.string()]),
      data: z.templateLiteral(["0x", z.string()]),
    }),
    step: signatureStep.optional(),
  }),
  z.object({
    kind: z.literal(SignaturePayloadKind.TYPED_DATA),
    typedData: typedDataPayload,
    take: laMargeTake.optional(),
    lamarge: laMargeRequestContext.optional(),
    depositVenue: z.enum(VenueId).optional(),
    send: laMargeSend.optional(),
    deletes: z.object({ venue: z.enum(VenueId), key: z.string() }).optional(),
    step: signatureStep.optional(),
    attestation: laMargeAttestation.optional(),
    gmxSubaccountApproval: gmxSubaccountApproval.optional(),
    gmxUsdcPermit: gmxUsdcPermit.optional(),
  }),
  z.object({
    kind: z.literal(SignaturePayloadKind.PERSONAL_MESSAGE),
    message: z.string(),
    take: laMargeTake.optional(),
    lamarge: laMargeRequestContext.optional(),
    depositVenue: z.enum(VenueId).optional(),
    step: signatureStep.optional(),
    attestation: laMargeAttestation.optional(),
  }),
])

export { laMargeRequestContext, laMargeTake, signaturePayload, typedDataPayload }
