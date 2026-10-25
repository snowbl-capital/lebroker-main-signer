import type { Address, Hex } from "viem"

/** An address Main approves funds to go to, checksummed, with the label the user reads beside it. */
type AddressBookRecipient = { address: Address; label: string }

/** What an address-book entry says (D70): Main, checksummed, the recipients it approves, and when, in ms. */
type AddressBookContent = { main: Address; recipients: AddressBookRecipient[]; at: number }

/** What to write: addresses in any case, written checksummed. */
type AddressBookMessageProps = { main: string; recipients: readonly { address: string; label: string }[]; at: number }

type ParseAddressBookMessageProps = { message: string }

/** `main`: the address the entry must name and whose key must have signed it, as the reader knows it itself. */
type VerifiedAddressBookEntryProps = { main: string; message: string; signature: Hex }

type ContentProblemProps = { content: AddressBookContent }

type RecipientLineProps = { line: string }

type FullAddressProps = { address: string }

export type {
  AddressBookContent,
  AddressBookMessageProps,
  AddressBookRecipient,
  ContentProblemProps,
  FullAddressProps,
  ParseAddressBookMessageProps,
  RecipientLineProps,
  VerifiedAddressBookEntryProps,
}
