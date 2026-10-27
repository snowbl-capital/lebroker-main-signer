import { z } from "zod"
import { AccountKind, AccountState, UserAccess, WalletKind } from "../accounts/model"

/** Who signed in to the hosted service: their id, Main's address, their wallet's kind and their access. */
const sessionUser = z.object({
  id: z.string(),
  address: z.string(),
  walletKind: z.enum(WalletKind),
  access: z.enum(UserAccess),
})

/** One of the user's accounts as the service shows it: never its key. Its address is null only while it's made. */
const accountView = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(AccountKind),
  slot: z.number().nullable(),
  address: z.string().nullable(),
  state: z.enum(AccountState),
  active: z.boolean(),
})

export { accountView, sessionUser }
