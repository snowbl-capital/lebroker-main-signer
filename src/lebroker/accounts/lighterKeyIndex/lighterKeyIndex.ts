import { LIGHTER_KEY_INDEX, LIGHTER_LAST_KEY_INDEX } from "../constants"
import type { IsLighterKeyIndexProps } from "./types"

/** Whether an API key index is one lebroker's key may take: from 200 to 253, below LaMarge's key at 254. */
function isLighterKeyIndex({ apiKeyIndex }: IsLighterKeyIndexProps): boolean {
  return Number.isInteger(apiKeyIndex) && apiKeyIndex >= LIGHTER_KEY_INDEX && apiKeyIndex <= LIGHTER_LAST_KEY_INDEX
}

export { isLighterKeyIndex }
