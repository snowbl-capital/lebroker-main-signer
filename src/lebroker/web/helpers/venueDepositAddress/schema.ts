import { getAddress, isAddress } from "viem"
import { z } from "zod"

/** Lighter's answer to `createIntentAddress`: the address whose USDC credits the L1 address it was made for. */
const lighterIntent = z.object({
  intent_address: z
    .string()
    .refine(value => isAddress(value, { strict: false }))
    .transform(value => getAddress(value)),
})

export { lighterIntent }
