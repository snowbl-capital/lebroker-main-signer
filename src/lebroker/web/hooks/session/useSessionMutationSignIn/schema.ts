import { z } from "zod"

const issuedNonce = z.object({ nonce: z.string(), chainId: z.number().int().positive().safe().nullable().default(null) })

export { issuedNonce }
