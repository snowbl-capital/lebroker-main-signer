import { AddressBookLine, AddressBookStatement } from "./enums"

/** The most recipients one entry names: every open sub-account in one signature, with room to spare. */
const ADDRESS_BOOK_MAX_RECIPIENTS = 20

/**
 * How far past a reader's own clock an entry may be dated, in ms: clocks a few minutes apart still agree, and an
 * entry dated later is ignored and never kept, so no far-future date holds over the withdrawals signed after it.
 */
const ADDRESS_BOOK_MAX_SKEW_MS = 10 * 60 * 1000

/** The longest label a recipient takes, in characters. */
const ADDRESS_BOOK_MAX_LABEL = 64

/**
 * A recipient's label: a name the user reads beside the address, as lebroker names its accounts ("Sub-account 1").
 * Never a colon nor a new line, so the address that ends its line is read where the wallet shows it.
 */
const ADDRESS_BOOK_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9 ._'()#-]*[A-Za-z0-9._'()#-])?$/

/** An address as an entry writes it, before its checksum is checked. */
const ADDRESS_BOOK_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * The deployment an entry is for, as a URL's `host` writes it: a lower-case name or IPv6 address, and its port when it
 * isn't the scheme's own (`lebroker.dev.lamarge.trade`, `127.0.0.1:8190`).
 */
const ADDRESS_BOOK_DEPLOYMENT = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::\d{1,5})?$/

/** The line that says what an entry says of its recipients. */
const STATEMENT_LINES: Readonly<Record<AddressBookStatement, AddressBookLine>> = {
  [AddressBookStatement.APPROVE]: AddressBookLine.APPROVE,
  [AddressBookStatement.WITHDRAW]: AddressBookLine.WITHDRAW,
}

/** secp256k1's group order: an ECDSA signature's `r` and `s` are below it, its canonical `s` at most half of it. */
const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

/** An ECDSA signature's lengths in hex digits, `0x` aside: 65 bytes (`r`, `s`, `v`), or 64 (EIP-2098, `v` in `s`). */
const SIGNATURE_HEX_LENGTH = 130
const COMPACT_SIGNATURE_HEX_LENGTH = 128

/** `v` as Ethereum writes it in a canonical signature: 27 plus the recovery bit. */
const SIGNATURE_V_BASE = 27

export {
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
}
