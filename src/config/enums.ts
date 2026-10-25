enum EnvName {
  LEBROKER_URL = "LEBROKER_URL",
  MAIN_KEYS_DIR = "MAIN_KEYS_DIR",
  MAIN_WALLETS = "MAIN_WALLETS",
  MAIN_CHAIN_ID = "MAIN_CHAIN_ID",
  MAIN_ADDRESS_BOOK_FILE = "MAIN_ADDRESS_BOOK_FILE",
}

// Never quote a key back: these messages reach the terminal. A URL's host and a wallet's label are safe to name.
enum ConfigError {
  URL_MISSING = "Set LEBROKER_URL to the lebroker service's address, such as http://127.0.0.1:8190",
  URL_MALFORMED = "LEBROKER_URL must be an http:// or https:// address, such as http://127.0.0.1:8190",
  URL_NOT_LOOPBACK = "LEBROKER_URL may use plain http only on this machine (localhost, 127.0.0.1 or ::1): use https for any other host:",
  URL_WITH_CREDENTIALS = "LEBROKER_URL must not hold a user name or a password",
  KEYS_DIR_MISSING = "Set MAIN_KEYS_DIR to a folder of <label>.key files, one per Main wallet",
  CHAIN_ID_MALFORMED = "MAIN_CHAIN_ID must be a positive whole number, the chain id your browser wallet usually shows",
  WALLET_LABEL_MALFORMED = "MAIN_WALLETS lists wallets by label, separated by commas: 1 to 32 lowercase letters, digits or dashes. Not a label:",
}

export { ConfigError, EnvName }
