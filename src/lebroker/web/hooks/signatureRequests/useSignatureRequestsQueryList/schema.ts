import { z } from "zod"
import { signaturePayload, SignatureRequestKind, SignatureRequestReason, SignatureRequestState } from "../../../../accounts/model"

/** A request waiting for Main (D37), as the banner and its dialog read it. */
const signatureRequestView = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  kind: z.enum(SignatureRequestKind),
  reason: z.enum(SignatureRequestReason),
  venue: z.string().nullable(),
  subject: z.string(),
  why: z.string().nullable(),
  consequence: z.string(),
  deadline: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  state: z.enum(SignatureRequestState),
  deferredUntil: z.string().nullable(),
  payload: signaturePayload,
})

/** The open requests, most urgent first, and how many wait: deferred ones don't count. */
const signatureRequestsList = z.object({ requests: z.array(signatureRequestView), waiting: z.number() })

/** One request, as signing it, putting it off or setting a venue up answers it. */
const requestAnswer = z.object({ request: signatureRequestView })

export { requestAnswer, signatureRequestsList, signatureRequestView }
