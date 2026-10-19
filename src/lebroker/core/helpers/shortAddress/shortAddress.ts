import { ADDRESS_HEAD, ADDRESS_TAIL } from "./constants"
import type { ShortAddressProps } from "./types"

/** An address as people check it: its start and its end, 0x1234…abcd. */
function shortAddress({ address }: ShortAddressProps): string {
  if (address.length <= ADDRESS_HEAD + ADDRESS_TAIL) {
    return address
  }
  return `${address.slice(0, ADDRESS_HEAD)}…${address.slice(-ADDRESS_TAIL)}`
}

export { shortAddress }
