import { z } from "zod"
import { accountView } from "../../../schema"

/**
 * A closed sub-account funds reached before its key went: when the key goes, in ms since the epoch, and what it
 * holds in all, in dollars. Main keeps it before then, or the funds are lost with the key.
 */
const fundedClosedAccount = accountView.extend({ keyDeletionAt: z.number(), heldUsd: z.number() })

/** The user's accounts, Main first then by number, the one the session shows, and their closed sub-accounts funds reached. */
const accountsList = z.object({
  activeAccountId: z.string().nullable(),
  accounts: z.array(accountView),
  closed: z.array(fundedClosedAccount).default([]),
})

/** One account, as creating or closing it answers. */
const accountAnswer = z.object({ account: accountView })

export { accountAnswer, accountsList, fundedClosedAccount }
