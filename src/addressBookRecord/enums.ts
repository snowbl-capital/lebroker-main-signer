// Never quote the file's contents back: its name and what's wrong with it are enough.
enum AddressBookRecordError {
  MALFORMED = "MAIN_ADDRESS_BOOK_FILE isn't an address book record this signer writes: move it away only if you mean to forget the entries it kept",
}

export { AddressBookRecordError }
