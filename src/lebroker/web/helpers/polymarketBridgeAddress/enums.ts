/** Why Polymarket's bridge address couldn't be read: nothing is signed. */
enum PolymarketBridgeAddressError {
  UNREAD = "Polymarket's bridge couldn't be asked just now for the address it pays your Bybit from: nothing was signed. Try again in a moment.",
}

export { PolymarketBridgeAddressError }
