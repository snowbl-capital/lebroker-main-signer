import { isHex, type Hex } from "viem"
import { z } from "zod"

/** The record's file, as this signer writes it: every entry it checked, as signed. */
const recordFile = z.strictObject({
  entries: z.array(
    z.strictObject({
      message: z.string(),
      signature: z.custom<Hex>(value => typeof value === "string" && isHex(value)),
    }),
  ),
})

export { recordFile }
