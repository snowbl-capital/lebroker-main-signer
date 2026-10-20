import type { Hex } from "viem"
import { z } from "zod"

const hex = z.custom<Hex>(value => typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value))

const signInBody = z.object({ message: z.string(), signature: hex })

const declineBody = z.strictObject({ reason: z.string().min(1).max(300) })

const signBody = z.strictObject({ signature: z.custom<Hex>(value => typeof value === "string" && /^0x[0-9a-fA-F]{130}$/.test(value)) })

export { declineBody, signBody, signInBody }
