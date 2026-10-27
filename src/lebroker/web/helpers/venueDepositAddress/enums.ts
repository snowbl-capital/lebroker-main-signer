/** Why a venue's deposit address for Main couldn't be read: nothing is signed. */
enum VenueDepositAddressError {
  NONE = "leneutre opens no account on this venue with a withdrawal.",
  UNREAD = "The venue's deposit address for your Main couldn't be read just now: nothing was signed. Try again in a moment.",
}

export { VenueDepositAddressError }
