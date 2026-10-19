import type { z } from "zod"
import type { accountView, sessionUser } from "./schema"

/** Who signed in to the hosted service: their id, which Main's proofs name, Main's address and their access. */
type SessionUser = z.infer<typeof sessionUser>

/** One of the user's accounts: Main or a sub-account, by its fixed name (D35). */
type AccountView = z.infer<typeof accountView>

export type { AccountView, SessionUser }
