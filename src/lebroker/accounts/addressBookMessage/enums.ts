/**
 * The fixed words of Main's address-book entry (D70), as the wallet shows them in clear: the app, Main, the recipients
 * with their labels, and the date.
 */
enum AddressBookLine {
  TITLE = "lebroker address book",
  MAIN = "Main: ",
  RECIPIENTS = "I approve these addresses as recipients of transfers from this Main:",
  /** Before a recipient's label. */
  RECIPIENT = "- ",
  /** Between a recipient's label and its address. */
  LABEL_END = ": ",
  DATE = "Date: ",
}

/** Why an address-book entry can't be written as asked. */
enum AddressBookMessageError {
  NO_RECIPIENT = "An address book entry approves one address at least.",
  TOO_MANY = "An address book entry approves 20 addresses at most.",
  NOT_AN_ADDRESS = "An address book entry approves addresses only.",
  MAIN_ITSELF = "Main is never its own recipient.",
  TWICE = "An address book entry approves each address once.",
  LABEL = "A recipient's label is 1 to 64 letters, digits, spaces or . _ ' ( ) # -, starting with a letter or a digit.",
  DATE = "An address book entry's date is a time.",
}

export { AddressBookLine, AddressBookMessageError }
