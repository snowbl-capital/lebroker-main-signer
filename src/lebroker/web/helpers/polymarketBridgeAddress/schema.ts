import { getAddress, isAddress } from "viem"
import { z } from "zod"

/** The bridge's withdrawal address for a recipient: its EVM one is what Main's Deposit Wallet pays. */
const bridgeWithdrawal = z.object({
  address: z.object({
    evm: z
      .string()
      .refine(value => isAddress(value, { strict: false }))
      .transform(value => getAddress(value)),
  }),
})

export { bridgeWithdrawal }
