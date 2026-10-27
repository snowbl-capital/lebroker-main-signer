/**
 * Which of lebroker's Aster agents Main approves: the trading one and the conversion one are those Main's allowlist
 * signs, each under its own name with its own permissions; the withdrawal one never.
 */
enum AsterAgentKind {
  TRADING = "trading",
  WITHDRAWAL = "withdrawal",
  /** Sells on Spot what a move converts first, and moves it between the account's own wallets: nothing else. */
  CONVERT = "convert",
}

export { AsterAgentKind }
