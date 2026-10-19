import type { SameAddressProps } from "./types"

/** Whether two addresses name one account: a wallet gives it checksummed, a server may give it in lower case. */
function sameAddress({ address, other }: SameAddressProps): boolean {
  return address.toLowerCase() === other.toLowerCase()
}

export { sameAddress }
