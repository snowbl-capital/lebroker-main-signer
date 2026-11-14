import { LIGHTER_API_URL, LighterEndpoint, LighterLookup } from "../../../venues/model"
import { LIGHTER_ACCOUNT_TIMEOUT_MS } from "./constants"
import { LighterAccountAddressesError } from "./enums"
import { lighterAccounts } from "./schema"
import type { LighterAccountAddressesProps, LighterAccountAddressProps } from "./types"

/** One account's owner, as Lighter's public read answers it; any other answer throws. */
async function lighterAccountAddress({ index }: LighterAccountAddressProps): Promise<string> {
  const query = new URLSearchParams({ by: LighterLookup.INDEX, value: String(index) })
  const response = await fetch(`${LIGHTER_API_URL}${LighterEndpoint.ACCOUNT}?${query.toString()}`, {
    // Lighter's own answer only: a redirect elsewhere reads nothing.
    redirect: "error",
    signal: AbortSignal.timeout(LIGHTER_ACCOUNT_TIMEOUT_MS),
  }).catch(() => {
    throw new Error(LighterAccountAddressesError.UNREAD)
  })
  const answer: unknown = response.ok ? await response.json().catch(() => null) : null
  const parsed = lighterAccounts.safeParse(answer)
  const account = parsed.success ? parsed.data.accounts.find(entry => entry.index === index) : undefined
  if (account === undefined) {
    throw new Error(LighterAccountAddressesError.UNREAD)
  }
  return account.l1_address
}

/**
 * The L1 address that owns each Lighter account a transfer names, read by the signing side itself from Lighter, never
 * from lebroker: Lighter's transfer message names its accounts by index alone. Any account unread throws: nothing is
 * signed.
 */
async function lighterAccountAddresses({ indexes }: LighterAccountAddressesProps): Promise<ReadonlyMap<number, string>> {
  const read = await Promise.all([...new Set(indexes)].map(async index => [index, await lighterAccountAddress({ index })] as const))
  return new Map(read)
}

export { lighterAccountAddresses }
