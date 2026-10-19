import type { Hex } from "viem"
import { z } from "zod"

const hex = z.custom<Hex>(value => typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value))

const signInBody = z.object({ message: z.string(), signature: hex })

const signBody = z.strictObject({ signature: z.custom<Hex>(value => typeof value === "string" && /^0x[0-9a-fA-F]{130}$/.test(value)) })

export { signBody, signInBody }
