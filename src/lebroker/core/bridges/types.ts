import type { ChainId } from "./enums"

/**
 * A chain margin crosses between venues: its name, the token its gas is paid in, and its block explorer, where a
 * transaction's page is `<explorerUrl>/tx/<hash>`.
 */
type ChainInfo = { id: ChainId; name: string; nativeSymbol: string; explorerUrl: string }

export type { ChainInfo }
