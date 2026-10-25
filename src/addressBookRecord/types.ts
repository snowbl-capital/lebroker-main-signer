import type { Hex } from "viem"
import type { AddressBookContent } from "../lebroker/accounts/addressBookMessage/types"

/** An address-book entry as signed (lebroker's D70): the message and its signature. Neither is a secret. */
type SignedEntry = { message: string; signature: Hex }

/** An entry this signer checked itself: Main's own key signed it, for this deployment. `content`: what it says. */
type VerifiedEntry = SignedEntry & { content: AddressBookContent }

/**
 * The entries this machine has seen and checked, kept in a file of their own across restarts: what a service gone
 * wrong later stops listing, a withdrawal above all, still holds here.
 */
type AddressBookRecord = {
  /** Keeps the entries not kept yet, and writes the file when one is new. Rejects when the file can't be written. */
  keep: (props: KeepProps) => Promise<void>
  /** What every entry kept for this Main says. */
  statementsOf: (props: StatementsOfProps) => AddressBookContent[]
}

/**
 * `path`: the file, made at the first entry kept, read at the start. `deployment`: the host of the lebroker deployment
 * the signer signs for, the one the entries it uses must name.
 */
type OpenAddressBookRecordProps = { path: string; deployment: string }

type KeepProps = { entries: readonly VerifiedEntry[] }

/** `main`: the wallet's own address, any case. */
type StatementsOfProps = { main: string }

type WriteRecordProps = { path: string; entries: readonly SignedEntry[] }

type ReadRecordProps = { path: string }

export type {
  AddressBookRecord,
  KeepProps,
  OpenAddressBookRecordProps,
  ReadRecordProps,
  SignedEntry,
  StatementsOfProps,
  VerifiedEntry,
  WriteRecordProps,
}
