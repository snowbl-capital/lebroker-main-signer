/** Why a venue's deposit address for Main couldn't be read: nothing is signed. */
enum VenueDepositAddressError {
  NONE = "leneutre opens no account on this venue with a withdrawal.",
  UNREAD = "The venue's deposit address for your Main couldn't be read just now: nothing was signed. Try again in a moment.",
  BYBIT_UNSIGNED = "Your Main hasn't signed its Bybit deposit address: sign it in Bybit's setup first. Nothing was signed.",
  BYBIT_CHANGED = "Bybit now shows another deposit address than the one your Main signed: sign it again in Bybit's setup. Nothing was signed.",
  BYBIT_NOT_MAIN = "Your Main didn't sign the Bybit deposit address this pays: nothing was signed.",
}

export { VenueDepositAddressError }
