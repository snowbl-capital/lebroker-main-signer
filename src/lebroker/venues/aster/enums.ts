/** The agents an account gives lebroker: one trades perps, another only withdraws, a third only converts on Spot. */
enum AsterAgentKind {
  TRADING = "trading",
  WITHDRAWAL = "withdrawal",
  /** Sells on Spot what a move converts first, and moves it between the account's own wallets: nothing else. */
  CONVERT = "convert",
}

export { AsterAgentKind }
