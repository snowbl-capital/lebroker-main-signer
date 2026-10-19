import { z } from "zod"
import { sessionUser } from "../lebroker/web/schema"

/** The session as lebroker's hosted service answers it: the user, whose id Main's proofs name, and the account shown. */
const sessionBody = z.object({
  user: sessionUser.nullable().optional(),
  accountId: z.string().nullable().optional(),
  address: z.string(),
  expiresAt: z.string(),
})

/** A refusal's words, as lebroker writes them. */
const errorBody = z.object({ error: z.string() })

export { errorBody, sessionBody }
