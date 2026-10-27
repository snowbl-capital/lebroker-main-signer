import { getAddress, isHex, verifyMessage, type Address, type Hex } from "viem"
import {
  ADDRESS_BOOK_ADDRESS,
  ADDRESS_BOOK_DEPLOYMENT,
  ADDRESS_BOOK_LABEL,
  ADDRESS_BOOK_MAX_LABEL,
  ADDRESS_BOOK_MAX_RECIPIENTS,
  ADDRESS_BOOK_MAX_SKEW_MS,
  COMPACT_SIGNATURE_HEX_LENGTH,
  SECP256K1_ORDER,
  SIGNATURE_HEX_LENGTH,
  SIGNATURE_V_BASE,
  STATEMENT_LINES,
} from "./constants"
import { AddressBookLine, AddressBookMessageError, AddressBookStatement } from "./enums"
import type {
  AddressBookContent,
  AddressBookMessageProps,
  AddressBookRecipient,
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
  if (!ADDRESS_BOOK_DEPLOYMENT.test(content.deployment)) {
    return AddressBookMessageError.DEPLOYMENT
  }
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
 * Main's address-book entry, as its wallet signs it in clear (EIP-191): the app, the deployment it's for by its
 * host, Main, whether Main approves the recipients or withdraws their approval, each recipient's label and full
 * checksummed address, one a line, and the date. Throws the first problem of what's asked.
 */
function addressBookMessage({ statement, deployment, main, recipients, at }: AddressBookMessageProps): string {
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
  const problem = contentProblem({ content: { statement, deployment, main: mainAddress, recipients: written, at } })
  if (problem !== null) {
    throw new Error(problem)
  }
  return [
    AddressBookLine.TITLE,
    "",
    `${AddressBookLine.DEPLOYMENT}${deployment}`,
    `${AddressBookLine.MAIN}${mainAddress}`,
    "",
    STATEMENT_LINES[statement],
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

/** What the line before the recipients says of them; null for any other line. */
function statementOfLine({ line }: StatementOfLineProps): AddressBookStatement | null {
  return Object.values(AddressBookStatement).find(statement => STATEMENT_LINES[statement] === line) ?? null
}

/** What an address-book entry says, read back word for word as `addressBookMessage` writes it; null for any other text. */
function parseAddressBookMessage({ message }: ParseAddressBookMessageProps): AddressBookContent | null {
  const lines = message.split("\n")
  const deploymentLine = lines[2] ?? ""
  const mainLine = lines[3] ?? ""
  const dateLine = lines.at(-1) ?? ""
  const main = mainLine.startsWith(AddressBookLine.MAIN) ? writtenAddress({ address: mainLine.slice(AddressBookLine.MAIN.length) }) : null
  const statement = statementOfLine({ line: lines[5] })
  const iso = dateLine.startsWith(AddressBookLine.DATE) ? dateLine.slice(AddressBookLine.DATE.length) : ""
  const at = Date.parse(iso)
  if (
    lines[0] !== AddressBookLine.TITLE ||
    lines[1] !== "" ||
    !deploymentLine.startsWith(AddressBookLine.DEPLOYMENT) ||
    lines[4] !== "" ||
    lines.at(-2) !== "" ||
    main === null ||
    statement === null ||
    !Number.isFinite(at) ||
    new Date(at).toISOString() !== iso
  ) {
    return null
  }
  const recipients: AddressBookRecipient[] = []
  for (const line of lines.slice(6, -2)) {
    const recipient = recipientLine({ line })
    if (recipient === null) {
      return null
    }
    recipients.push(recipient)
  }
  const content = { statement, deployment: deploymentLine.slice(AddressBookLine.DEPLOYMENT.length), main, recipients, at }
  return contentProblem({ content }) === null ? content : null
}

/**
 * An ECDSA signature in its one canonical encoding: 65 bytes, lower-case hex, `s` in the lower half of the curve's order
 * and `v` 27 or 28. A 64-byte (EIP-2098) signature, `v` written 0 or 1, or a high `s` all name the same signature,
 * which this writes one way only. Null for anything that isn't an ECDSA signature.
 */
function canonicalSignature({ signature }: CanonicalSignatureProps): Hex | null {
  if (!isHex(signature, { strict: true })) {
    return null
  }
  const digits = signature.slice(2).toLowerCase()
  const compact = digits.length === COMPACT_SIGNATURE_HEX_LENGTH
  if (!compact && digits.length !== SIGNATURE_HEX_LENGTH) {
    return null
  }
  const r = BigInt(`0x${digits.slice(0, 64)}`)
  const second = BigInt(`0x${digits.slice(64, 128)}`)
  const v = compact ? null : Number.parseInt(digits.slice(128), 16)
  // A 64-byte signature carries its recovery bit as the top bit of `s`; a 65-byte one as `v`, 0 or 1, or 27 or 28.
  const bit = v === null ? Number(second >> 255n) : v < SIGNATURE_V_BASE ? v : v - SIGNATURE_V_BASE
  const s = compact ? second & ((1n << 255n) - 1n) : second
  if ((bit !== 0 && bit !== 1) || r === 0n || r >= SECP256K1_ORDER || s === 0n || s >= SECP256K1_ORDER) {
    return null
  }
  const high = s > SECP256K1_ORDER / 2n
  const lowS = high ? SECP256K1_ORDER - s : s
  const canonicalBit = high ? 1 - bit : bit
  return `0x${r.toString(16).padStart(64, "0")}${lowS.toString(16).padStart(64, "0")}${(SIGNATURE_V_BASE + canonicalBit).toString(16)}`
}

/**
 * The entry Main's own key signed: the message reads as an entry, names exactly this Main and this deployment,
 * and its EIP-191 signature recovers to that Main. Null otherwise. A key's signature only, checked with no call out: a
 * contract wallet's is checked on its chain, by whoever can read it.
 */
async function verifiedAddressBookEntry({
  main,
  deployment,
  message,
  signature,
}: VerifiedAddressBookEntryProps): Promise<AddressBookContent | null> {
  const content = parseAddressBookMessage({ message })
  if (content === null || content.main.toLowerCase() !== main.toLowerCase() || content.deployment !== deployment) {
    return null
  }
  const signed = await verifyMessage({ address: content.main, message, signature }).catch(() => false)
  return signed ? content : null
}

/**
 * Whether an entry's date is within the reader's own clock: no more than `ADDRESS_BOOK_MAX_SKEW_MS` past it. One
 * dated later is ignored and never kept: a far-future approval would otherwise hold over every withdrawal after it.
 */
function withinClock({ at, now }: WithinClockProps): boolean {
  return at <= now + ADDRESS_BOOK_MAX_SKEW_MS
}

/** Whether one entry holds over another naming the same address: dated later, or a withdrawal dated as an approval. */
function holdsOver({ said, kept }: HoldsOverProps): boolean {
  return (
    said.at > kept.at ||
    (said.at === kept.at && said.statement === AddressBookStatement.WITHDRAW && kept.statement === AddressBookStatement.APPROVE)
  )
}

/**
 * The recipients approved now: for each address, the latest dated entry naming it holds, an approval or its
 * withdrawal; a withdrawal dated the same as an approval holds over it. Addresses matched whatever their case. An entry
 * dated past the reader's clock by more than the skew says nothing.
 */
function approvedRecipientsOf({ statements, now }: ApprovedRecipientsOfProps): ApprovedRecipient[] {
  const latest = new Map<string, ApprovedRecipient & { statement: AddressBookStatement }>()
  for (const said of statements) {
    if (!withinClock({ at: said.at, now })) {
      continue
    }
    for (const recipient of said.recipients) {
      const key = recipient.address.toLowerCase()
      const kept = latest.get(key)
      if (kept === undefined || holdsOver({ said, kept })) {
        latest.set(key, { statement: said.statement, address: recipient.address, label: recipient.label, at: said.at })
      }
    }
  }
  return [...latest.values()]
    .filter(kept => kept.statement === AddressBookStatement.APPROVE)
    .map(kept => ({ address: kept.address, label: kept.label, at: kept.at }))
}

/** Whether a text is, or carries, an address-book entry: what Main's user alone signs, in their wallet, never a signer. */
function isAddressBookMessage({ message }: ParseAddressBookMessageProps): boolean {
  return message.includes(AddressBookLine.TITLE)
}

export {
  addressBookMessage,
  approvedRecipientsOf,
  canonicalSignature,
  holdsOver,
  isAddressBookMessage,
  parseAddressBookMessage,
  verifiedAddressBookEntry,
  withinClock,
}
