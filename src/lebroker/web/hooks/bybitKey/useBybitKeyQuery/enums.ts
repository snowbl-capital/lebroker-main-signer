/** Where Main's signed Bybit deposit address stands, against what Bybit shows now, as the executor says. */
enum BybitDepositState {
  /** Main signed none: Hyperliquid doesn't pay Bybit straight. */
  NONE = "none",
  /** Main signed the address Bybit shows. */
  SIGNED = "signed",
  /** Bybit shows another address than the one Main signed: Main signs it again. */
  CHANGED = "changed",
  /** Bybit's address couldn't be read just now: what Main signed stands. */
  UNREAD = "unread",
}

export { BybitDepositState }
