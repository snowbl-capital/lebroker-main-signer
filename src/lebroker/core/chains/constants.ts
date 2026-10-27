import { ChainId } from "./enums"
import type { ChainInfo } from "./types"

/** Each chain margin crosses between venues, by its id. */
const CHAINS: Record<ChainId, ChainInfo> = {
  [ChainId.ETHEREUM]: { id: ChainId.ETHEREUM, name: "Ethereum", nativeSymbol: "ETH", explorerUrl: "https://etherscan.io" },
  [ChainId.BSC]: { id: ChainId.BSC, name: "BSC", nativeSymbol: "BNB", explorerUrl: "https://bscscan.com" },
  [ChainId.POLYGON]: { id: ChainId.POLYGON, name: "Polygon", nativeSymbol: "POL", explorerUrl: "https://polygonscan.com" },
  [ChainId.HYPEREVM]: { id: ChainId.HYPEREVM, name: "HyperEVM", nativeSymbol: "HYPE", explorerUrl: "https://hyperevmscan.io" },
  [ChainId.ARBITRUM]: { id: ChainId.ARBITRUM, name: "Arbitrum", nativeSymbol: "ETH", explorerUrl: "https://arbiscan.io" },
}

export { CHAINS }
