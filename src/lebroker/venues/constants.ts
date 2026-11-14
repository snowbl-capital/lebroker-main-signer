import type { GatewayToken } from "../core/model"

/** The stablecoins the venues' gateways move, by chain: each one's contract, as its issuer and the chain's explorer give it. */
const ARBITRUM_USDC: GatewayToken = { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 }

export { ARBITRUM_USDC }
