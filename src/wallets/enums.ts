// Never quote a key back, nor a key file's path: these messages reach the terminal and the logs. A label is safe to name.
enum WalletError {
  FILE_KEY_MALFORMED = "This key file in MAIN_KEYS_DIR must hold 32 bytes in hex, with or without 0x:",
  KEYS_DIR_UNREADABLE = "MAIN_KEYS_DIR must be a folder this user can read",
  KEYS_DIR_EMPTY = "MAIN_KEYS_DIR holds no key file: put one <label>.key file per Main wallet in it",
  DUPLICATE = "Two key files in MAIN_KEYS_DIR hold the same wallet:",
  KEY_FILE_SHARED = "This key file in MAIN_KEYS_DIR can be read by other users: make it its owner's only (chmod 600):",
  KEY_FILE_NOT_FILE = "This entry of MAIN_KEYS_DIR must be a file:",
  LABEL_MALFORMED = "A wallet's label is 1 to 32 lowercase letters, digits or dashes, starting with a letter or a digit:",
  /** In place of a value too long to be a label: a key pasted where a label goes is never said back. */
  LABEL_NOT_SAID = "(a value longer than a label, not shown here)",
  DIR_KEY_FILE_UNREADABLE = "This key file in MAIN_KEYS_DIR can't be read by this user:",
  /** MAIN_WALLETS names a wallet the folder has no key file for. */
  UNKNOWN_LABEL = "MAIN_WALLETS names a wallet MAIN_KEYS_DIR has no <label>.key file for:",
}

export { WalletError }
