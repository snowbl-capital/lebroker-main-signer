/**
 * The fixed words of Main's address-book entry, as the wallet shows them in clear: the app, the deployment it's
 * for, Main, what Main says of the recipients with their labels, and the date.
 */
enum AddressBookLine {
  TITLE = "lebroker address book",
  /** Before the host of the lebroker deployment the entry is for: another deployment's signer reads no entry of it. */
  DEPLOYMENT = "Deployment: ",
  MAIN = "Main: ",
  APPROVE = "I approve these addresses as recipients of transfers from this Main:",
  WITHDRAW = "I withdraw approval of these addresses as recipients of transfers from this Main:",
  /** Before a recipient's label. */
  RECIPIENT = "- ",
  /** Between a recipient's label and its address. */
  LABEL_END = ": ",
  DATE = "Date: ",
}

/** What an entry says of its recipients: approved, or no longer. For each address, the latest dated entry holds. */
enum AddressBookStatement {
  APPROVE = "approve",
  WITHDRAW = "withdraw",
}

/** Why an address-book entry can't be written as asked. */
enum AddressBookMessageError {
  NO_RECIPIENT = "An address book entry names one address at least.",
  TOO_MANY = "An address book entry names 20 addresses at most.",
  NOT_AN_ADDRESS = "An address book entry names addresses only.",
  MAIN_ITSELF = "Main is never its own recipient.",
  TWICE = "An address book entry names each address once.",
  LABEL = "A recipient's label is 1 to 64 letters, digits, spaces or . _ ' ( ) # -, starting with a letter or a digit.",
  DATE = "An address book entry's date is a time.",
  DEPLOYMENT = "An address book entry names the leneutre deployment it's for by its host, in lower case.",
}

export { AddressBookLine, AddressBookMessageError, AddressBookStatement }
