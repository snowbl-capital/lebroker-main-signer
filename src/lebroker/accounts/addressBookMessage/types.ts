import type { Address, Hex } from "viem"
import type { AddressBookStatement } from "./enums"

/** An address an entry names, checksummed, with the label the user reads beside it. */
type AddressBookRecipient = { address: Address; label: string }

/**
 * What an address-book entry says: the deployment it's for, by host; Main, checksummed; whether it approves its
 * recipients or withdraws their approval; and when, in ms.
 */
type AddressBookContent = {
  statement: AddressBookStatement
  deployment: string
  main: Address
  recipients: AddressBookRecipient[]
  at: number
}

/** What to write: addresses in any case, written checksummed; `deployment`, the app's own host. */
type AddressBookMessageProps = {
  statement: AddressBookStatement
  deployment: string
  main: string
  recipients: readonly { address: string; label: string }[]
  at: number
}

type ParseAddressBookMessageProps = { message: string }

/**
 * `main`: the address the entry must name and whose key must have signed it; `deployment`: the host it must name. Both
 * as the reader knows them itself.
 */
type VerifiedAddressBookEntryProps = { main: string; deployment: string; message: string; signature: Hex }

/** One entry as the latest-wins reading takes it: what it says, of which addresses, when (ms). Addresses in any case. */
type AddressBookStatementOf = {
  statement: AddressBookStatement
  recipients: readonly { address: string; label: string }[]
  at: number
}

/** `now`: the reader's own clock, in ms; an entry dated more than `ADDRESS_BOOK_MAX_SKEW_MS` past it says nothing. */
type ApprovedRecipientsOfProps = { statements: readonly AddressBookStatementOf[]; now: number }

/** Two entries naming one address: whether `said` holds over `kept`. */
type HoldsOverProps = { said: Pick<AddressBookStatementOf, "statement" | "at">; kept: Pick<AddressBookStatementOf, "statement" | "at"> }

/** `at`: an entry's date; `now`: the reader's own clock. Both in ms. */
type WithinClockProps = { at: number; now: number }

/** A recipient approved now: as the latest entry naming it writes it, and that entry's date (ms). */
type ApprovedRecipient = { address: string; label: string; at: number }

type CanonicalSignatureProps = { signature: string }

type ContentProblemProps = { content: AddressBookContent }

type RecipientLineProps = { line: string }

type FullAddressProps = { address: string }

type StatementOfLineProps = { line: string | undefined }

export type {
  AddressBookContent,
  AddressBookMessageProps,
  AddressBookRecipient,
  AddressBookStatementOf,
  ApprovedRecipient,
  ApprovedRecipientsOfProps,
  CanonicalSignatureProps,
  ContentProblemProps,
  FullAddressProps,
  HoldsOverProps,
  ParseAddressBookMessageProps,
  RecipientLineProps,
  StatementOfLineProps,
  VerifiedAddressBookEntryProps,
  WithinClockProps,
}
