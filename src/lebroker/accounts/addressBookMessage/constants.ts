/** The most recipients one entry approves: every open sub-account in one signature, with room to spare. */
const ADDRESS_BOOK_MAX_RECIPIENTS = 20

/** The longest label a recipient takes, in characters. */
const ADDRESS_BOOK_MAX_LABEL = 64

/**
 * A recipient's label: a name the user reads beside the address, as lebroker names its accounts ("Sub-account 1").
 * Never a colon nor a new line, so the address that ends its line is read where the wallet shows it.
 */
const ADDRESS_BOOK_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9 ._'()#-]*[A-Za-z0-9._'()#-])?$/

/** An address as an entry writes it, before its checksum is checked. */
const ADDRESS_BOOK_ADDRESS = /^0x[0-9a-fA-F]{40}$/

export { ADDRESS_BOOK_ADDRESS, ADDRESS_BOOK_LABEL, ADDRESS_BOOK_MAX_LABEL, ADDRESS_BOOK_MAX_RECIPIENTS }
