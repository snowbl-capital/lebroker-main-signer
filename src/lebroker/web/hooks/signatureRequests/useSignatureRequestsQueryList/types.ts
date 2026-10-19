import type { z } from "zod"
import type { signatureRequestsList, signatureRequestView } from "./schema"

type SignatureRequestsList = z.output<typeof signatureRequestsList>

type SignatureRequestView = z.output<typeof signatureRequestView>

export type { SignatureRequestsList, SignatureRequestView }
