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
  /** Why Main's own signer won't sign it, in its words; null when it didn't say so, or the service doesn't tell. */
  signerDeclined: z.string().nullable().default(null),
})

/** Whether Main's own signer is connected to sign the requests, and since when. */
const mainSignerView = z.object({ connected: z.boolean(), since: z.string().nullable() })

/**
 * The open requests, most urgent first, how many wait (deferred ones don't count), and Main's own signer: not
 * connected, for a service that doesn't tell, as the Main signer may read one older than itself.
 */
const signatureRequestsList = z.object({
  requests: z.array(signatureRequestView),
  waiting: z.number(),
  mainSigner: mainSignerView.default({ connected: false, since: null }),
})

/** One request, as signing it, putting it off or setting a venue up answers it. */
const requestAnswer = z.object({ request: signatureRequestView })

export { mainSignerView, requestAnswer, signatureRequestsList, signatureRequestView }
