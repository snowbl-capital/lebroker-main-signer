import type { z } from "zod"
import type { accountView, sessionUser, sharedAccountView } from "./schema"

/** Who signed in to the hosted service: their id, which Main's proofs name, Main's address and their access. */
type SessionUser = z.infer<typeof sessionUser>

/** One of the user's accounts: Main or a sub-account, by its fixed name. */
type AccountView = z.infer<typeof accountView>

/** A sub-account another user shares with this one, with its owner and what this user may do there. */
type SharedAccountView = z.infer<typeof sharedAccountView>

export type { AccountView, SessionUser, SharedAccountView }
