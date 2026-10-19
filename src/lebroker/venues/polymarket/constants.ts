/** Commands and the proxy's creation are signed as EIP-712 typed data in this domain: Polygon's chain id, no contract. */
const SIGN_DOMAIN = { name: "Polymarket", version: "1", chainId: 137 } as const

/** The owner's approval of a proxy key until a time, in milliseconds. */
const CREATE_PROXY_TYPES = {
  CreateProxy: [
    { name: "addr", type: "address" },
    { name: "exp", type: "uint64" },
    { name: "salt", type: "uint64" },
    { name: "ts", type: "uint64" },
  ],
} as const

/** A proxy lasts a week, Polymarket's own default, and is replaced a day before it expires. */
const PROXY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export { CREATE_PROXY_TYPES, PROXY_TTL_MS, SIGN_DOMAIN }
