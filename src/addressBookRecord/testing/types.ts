import type { PrivateKeyAccount } from "viem/accounts"
import type { AddressBookStatement } from "../../lebroker/accounts/model"

/** A test's entry: signed by `signer`, Main by default; an approval, for the tests' deployment, unless said. */
type EntryOfProps = { signer?: PrivateKeyAccount; statement?: AddressBookStatement; deployment?: string }

export type { EntryOfProps }
