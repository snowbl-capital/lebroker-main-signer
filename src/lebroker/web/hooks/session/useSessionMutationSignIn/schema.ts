import { z } from "zod"

const issuedNonce = z.object({ nonce: z.string() })

export { issuedNonce }
