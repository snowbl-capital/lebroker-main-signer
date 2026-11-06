import { shortAddress } from "../../../core/model"
import { SHARED_OWNER_SEPARATOR } from "./constants"
import type { SharedAccountNameProps } from "./types"

/** A sub-account another user shares with the user, named with its owner, wherever it's offered: "Hedges of 0x5714…0003". */
function sharedAccountName({ account }: SharedAccountNameProps): string {
  return `${account.name} ${SHARED_OWNER_SEPARATOR} ${shortAddress({ address: account.ownerAddress })}`
}

export { sharedAccountName }
