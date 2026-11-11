/** Which of a venue's networks a trader signs for. The executor only trades on mainnet when told to. */
enum Network {
  MAINNET = "mainnet",
  TESTNET = "testnet",
}

/**
 * Which of lebroker's deployments a process belongs to: production, development, or a stack run anywhere else (a
 * developer's machine). Each keeps its own slots on a Main's venue accounts, so that one's approval never replaces
 * another's.
 */
enum DeploymentEnvironment {
  PROD = "prod",
  DEV = "dev",
  LOCAL = "local",
}

/** The venues lebroker reads and trades, by the id their adapters give them. */
enum VenueId {
  HYPERLIQUID = "hyperliquid",
  POLYMARKET_PERPS = "polymarket-perps",
  ASTER = "aster",
  LIGHTER = "lighter",
  BYBIT = "bybit",
  GMX = "gmx",
}

export { Network, VenueId, DeploymentEnvironment }
