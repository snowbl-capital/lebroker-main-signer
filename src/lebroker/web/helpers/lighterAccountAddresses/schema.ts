import { getAddress, isAddress } from "viem"
import { z } from "zod"

/** Lighter's public read of an account by its index: its index and the L1 address that owns it. */
const lighterAccounts = z.object({
  accounts: z.array(
    z.object({
      index: z.number().int(),
      l1_address: z
        .string()
        .refine(value => isAddress(value, { strict: false }))
        .transform(value => getAddress(value)),
    }),
  ),
})

export { lighterAccounts }
