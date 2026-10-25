import { getAddress, verifyMessage, type Address } from "viem"
import { ADDRESS_BOOK_ADDRESS, ADDRESS_BOOK_LABEL, ADDRESS_BOOK_MAX_LABEL, ADDRESS_BOOK_MAX_RECIPIENTS } from "./constants"
import { AddressBookLine, AddressBookMessageError } from "./enums"
import type {
  AddressBookContent,
  AddressBookMessageProps,
  AddressBookRecipient,
  ContentProblemProps,
  FullAddressProps,
  ParseAddressBookMessageProps,
  RecipientLineProps,
  VerifiedAddressBookEntryProps,
} from "./types"

/** An address in full, checksummed from any case; null for anything else. */
function fullAddress({ address }: FullAddressProps): Address | null {
  return ADDRESS_BOOK_ADDRESS.test(address) ? getAddress(address) : null
}

/** An address exactly as an entry writes it, checksummed; null for any other form, its lower case included. */
function writtenAddress({ address }: FullAddressProps): Address | null {
  const full = fullAddress({ address })
  return full === address ? full : null
}

/** The first problem of what an entry says, in its words; null for none. What's written and what's read keep one rule. */
function contentProblem({ content }: ContentProblemProps): AddressBookMessageError | null {
  if (content.recipients.length === 0) {
    return AddressBookMessageError.NO_RECIPIENT
  }
  if (content.recipients.length > ADDRESS_BOOK_MAX_RECIPIENTS) {
    return AddressBookMessageError.TOO_MANY
  }
  if (Number.isNaN(new Date(content.at).getTime())) {
    return AddressBookMessageError.DATE
  }
  const seen = new Set<string>()
  for (const recipient of content.recipients) {
    if (recipient.label.length > ADDRESS_BOOK_MAX_LABEL || !ADDRESS_BOOK_LABEL.test(recipient.label)) {
      return AddressBookMessageError.LABEL
    }
    const address = recipient.address.toLowerCase()
    if (address === content.main.toLowerCase()) {
      return AddressBookMessageError.MAIN_ITSELF
    }
    if (seen.has(address)) {
      return AddressBookMessageError.TWICE
    }
    seen.add(address)
  }
  return null
}

/**
 * Main's address-book entry (D70), as its wallet signs it in clear (EIP-191): the app, Main, each recipient's label and
 * full checksummed address, one a line, and the date. Throws the first problem of what's asked.
 */
function addressBookMessage({ main, recipients, at }: AddressBookMessageProps): string {
  const mainAddress = fullAddress({ address: main })
  if (mainAddress === null) {
    throw new Error(AddressBookMessageError.NOT_AN_ADDRESS)
  }
  const written: AddressBookRecipient[] = []
  for (const recipient of recipients) {
    const address = fullAddress({ address: recipient.address })
    if (address === null) {
      throw new Error(AddressBookMessageError.NOT_AN_ADDRESS)
    }
    written.push({ address, label: recipient.label })
  }
  const problem = contentProblem({ content: { main: mainAddress, recipients: written, at } })
  if (problem !== null) {
    throw new Error(problem)
  }
  return [
    AddressBookLine.TITLE,
    "",
    `${AddressBookLine.MAIN}${mainAddress}`,
    "",
    AddressBookLine.RECIPIENTS,
    ...written.map(recipient => `${AddressBookLine.RECIPIENT}${recipient.label}${AddressBookLine.LABEL_END}${recipient.address}`),
    "",
    `${AddressBookLine.DATE}${new Date(at).toISOString()}`,
  ].join("\n")
}

/** A recipient's line, `- <label>: <address>`; null for any other. */
function recipientLine({ line }: RecipientLineProps): AddressBookRecipient | null {
  const end = line.lastIndexOf(AddressBookLine.LABEL_END)
  if (!line.startsWith(AddressBookLine.RECIPIENT) || end < AddressBookLine.RECIPIENT.length) {
    return null
  }
  const address = writtenAddress({ address: line.slice(end + AddressBookLine.LABEL_END.length) })
  return address === null ? null : { address, label: line.slice(AddressBookLine.RECIPIENT.length, end) }
}

/** What an address-book entry says, read back word for word as `addressBookMessage` writes it; null for any other text. */
function parseAddressBookMessage({ message }: ParseAddressBookMessageProps): AddressBookContent | null {
  const lines = message.split("\n")
  const mainLine = lines[2] ?? ""
  const dateLine = lines.at(-1) ?? ""
  const main = mainLine.startsWith(AddressBookLine.MAIN) ? writtenAddress({ address: mainLine.slice(AddressBookLine.MAIN.length) }) : null
  const iso = dateLine.startsWith(AddressBookLine.DATE) ? dateLine.slice(AddressBookLine.DATE.length) : ""
  const at = Date.parse(iso)
  if (
    lines[0] !== AddressBookLine.TITLE ||
    lines[1] !== "" ||
    lines[3] !== "" ||
    lines[4] !== AddressBookLine.RECIPIENTS ||
    lines.at(-2) !== "" ||
    main === null ||
    !Number.isFinite(at) ||
    new Date(at).toISOString() !== iso
  ) {
    return null
  }
  const recipients: AddressBookRecipient[] = []
  for (const line of lines.slice(5, -2)) {
    const recipient = recipientLine({ line })
    if (recipient === null) {
      return null
    }
    recipients.push(recipient)
  }
  const content = { main, recipients, at }
  return contentProblem({ content }) === null ? content : null
}

/**
 * The entry Main's own key signed (D70): the message reads as an entry, names exactly this Main, and its EIP-191
 * signature recovers to it. Null otherwise. A key's signature only, checked with no call out: a contract wallet's is
 * checked on its chain, by whoever can read it.
 */
async function verifiedAddressBookEntry({ main, message, signature }: VerifiedAddressBookEntryProps): Promise<AddressBookContent | null> {
  const content = parseAddressBookMessage({ message })
  if (content === null || content.main.toLowerCase() !== main.toLowerCase()) {
    return null
  }
  const signed = await verifyMessage({ address: content.main, message, signature }).catch(() => false)
  return signed ? content : null
}

/** Whether a text is, or carries, an address-book entry: what Main's user alone signs, in their wallet, never a signer. */
function isAddressBookMessage({ message }: ParseAddressBookMessageProps): boolean {
  return message.includes(AddressBookLine.TITLE)
}

export { addressBookMessage, isAddressBookMessage, parseAddressBookMessage, verifiedAddressBookEntry }
