/** Which of a venue's networks a trader signs for. The executor only trades on mainnet when told to. */
enum Network {
  MAINNET = "mainnet",
  TESTNET = "testnet",
}

/** The venues lebroker reads and trades, by the id their adapters give them. */
enum VenueId {
  HYPERLIQUID = "hyperliquid",
  POLYMARKET_PERPS = "polymarket-perps",
  ASTER = "aster",
  LIGHTER = "lighter",
  EXTENDED = "extended",
}

export { Network, VenueId }
