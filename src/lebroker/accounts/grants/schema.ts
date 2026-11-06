import { z } from "zod"
import { GrantAccess, GrantFeature } from "../enums"

/** Every feature's access, none left out: a grant names them all. */
const grantPolicies = z.strictObject({
  [GrantFeature.STRATEGIES]: z.enum(GrantAccess),
  [GrantFeature.EXECUTOR_RULES]: z.enum(GrantAccess),
  [GrantFeature.MARGIN_KEEPER]: z.enum(GrantAccess),
  [GrantFeature.MARGIN_MOVES]: z.enum(GrantAccess),
  [GrantFeature.VENUES]: z.enum(GrantAccess),
  [GrantFeature.NOTIFICATIONS]: z.enum(GrantAccess),
  [GrantFeature.MOVE_FUNDS_TO_MAIN]: z.enum(GrantAccess),
})

export { grantPolicies }
