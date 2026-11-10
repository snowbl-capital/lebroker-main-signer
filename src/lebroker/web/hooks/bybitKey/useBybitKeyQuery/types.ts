import type { z } from "zod"
import type { signedBybitDeposit } from "./schema"

type SignedBybitDeposit = z.output<typeof signedBybitDeposit>

export type { SignedBybitDeposit }
