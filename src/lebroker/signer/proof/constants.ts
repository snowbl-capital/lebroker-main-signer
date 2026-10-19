/** Main's proofs: lebroker's domain, on no chain in particular but Ethereum's id. */
const SUB_ACCOUNT_PROOF_DOMAIN = { name: "lebroker", version: "1", chainId: 1 } as const

/**
 * Main's proof that a Lighter account is its own: the index a transfer from a sub-account may send to. Lighter assigns
 * the index, and the signer reads no venue (D14), so only Main's word binds it.
 */
const MAIN_LIGHTER_ACCOUNT_PROOF_TYPES = {
  MainLighterAccount: [
    { name: "owner", type: "string" },
    { name: "account", type: "string" },
    { name: "main", type: "address" },
    { name: "accountIndex", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const

/** A proof lasts at most a day: it is signed right before the key is created. */
const MAX_PROOF_LIFETIME_MS = 24 * 60 * 60 * 1000

export { MAIN_LIGHTER_ACCOUNT_PROOF_TYPES, MAX_PROOF_LIFETIME_MS, SUB_ACCOUNT_PROOF_DOMAIN }
