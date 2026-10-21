/** The EVM chains margin crosses between venues, and those the gas reserve sends gas on (D51), by chain id. */
enum ChainId {
  ETHEREUM = 1,
  BSC = 56,
  POLYGON = 137,
  /** Hyperliquid's own EVM chain, where a send from HyperCore lands. */
  HYPEREVM = 999,
  ARBITRUM = 42161,
}

export { ChainId }
