import { CHAINS } from "../../chains/constants"
import type { ChainInfo } from "../../chains/types"
import type { ChainInfoProps } from "./types"

/** A chain lebroker knows, by its id: its name, its own token's symbol and its explorer; none for any other. */
function chainInfo({ chainId }: ChainInfoProps): ChainInfo | null {
  return Object.values(CHAINS).find(chain => chain.id === chainId) ?? null
}

export { chainInfo }
