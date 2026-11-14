import type { ChainId } from "./enums"

/**
 * A chain margin crosses between venues: its name, the token its gas is paid in, and its block explorer, where a
 * transaction's page is `<explorerUrl>/tx/<hash>`.
 */
type ChainInfo = { id: ChainId; name: string; nativeSymbol: string; explorerUrl: string }

/** A token on a chain, as a gateway moves it. Stablecoins only: a unit counts as a dollar. */
type GatewayToken = { symbol: string; address: string; decimals: number }

export type { ChainInfo, GatewayToken }
