import { ChainId } from "../../core/model"

/**
 * The token an internal transfer names: Perps' collateral, pUSD on Polygon, by its address. Polymarket answered "invalid
 * token address" to its symbol on 20 October 2026; LaMarge's server names it the same way.
 */
const PUSD = "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb"

/** Commands and the proxy's creation are signed as EIP-712 typed data in this domain: Polygon's chain id, no contract. */
const SIGN_DOMAIN = { name: "Polymarket", version: "1", chainId: 137 } as const

/** A command: the hash of its msgpack encoding, a salt used once, and the time it was signed, in milliseconds. */
const OP_TYPES = {
  Op: [
    { name: "data", type: "bytes32" },
    { name: "salt", type: "uint64" },
    { name: "ts", type: "uint64" },
  ],
} as const

/**
 * A withdrawal of Perps' margin, signed by the owner's own key, never a proxy's (Polymarket's docs, Fund your account):
 * in the Perps deposit contract's domain on Polygon, which checks `ts`, in seconds, against the block's time.
 */
const PERPS_WITHDRAW_DOMAIN = {
  name: "Polymarket",
  version: "1",
  chainId: 137,
  verifyingContract: "0xDCa4af75705dbB50f62437045afF9921947917d2",
} as const

/** Its fields, in their order: the account, pUSD, the amount in base units, Polymarket's fee (0), the receiver. */
const PERPS_WITHDRAW_TYPES = {
  Withdraw: [
    { name: "account", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "fee", type: "uint256" },
    { name: "to", type: "address" },
    { name: "salt", type: "uint64" },
    { name: "ts", type: "uint64" },
  ],
} as const

/** The fee a withdrawal from Perps signs: none, as the deposit contract's withdrawals are free. */
const PERPS_WITHDRAW_FEE = 0n

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

/**
 * Polymarket's bridge: the address that pays a recipient on another chain what a Deposit Wallet sends it, and the quote
 * of what it delivers. Public: no key, and it answers a browser's origin (CORS `*`, 8 November 2026).
 */
const BRIDGE_URL = "https://bridge.polymarket.com"

/** A Deposit Wallet's batch lasts 4 minutes from its signing, as lebroker's mainnet try of 8 November 2026 sent it. */
const DEPOSIT_WALLET_BATCH_SECONDS = 240

/** The Deposit Wallet's EIP-712 domain, on Polygon, the wallet itself its verifying contract. */
const DEPOSIT_WALLET_DOMAIN = { name: "DepositWallet", version: "1" } as const

const DEPOSIT_WALLET_CHAIN_ID = ChainId.POLYGON

/** A Deposit Wallet's batch of calls, as its owner signs it (docs.polymarket.com/trading/deposit-wallets). */
const DEPOSIT_WALLET_BATCH_TYPES = {
  Call: [
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
  Batch: [
    { name: "wallet", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "calls", type: "Call[]" },
  ],
} as const

/** An ERC-20 transfer, the one call a bridge withdrawal's batch makes. */
const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

/**
 * Polymarket's Deposit Wallet factory and beacon on Polygon (docs.polymarket.com/resources/contracts): a wallet is a
 * clone the factory deploys for its owner with CREATE2, so its address follows from the owner's alone.
 */
const DEPOSIT_WALLET_FACTORY = "0x00000000000Fb5C9ADea0298D729A0CB3823Cc07"

const DEPOSIT_WALLET_BEACON = "0x7A18EDfe055488A3128f01F563e5B479D92ffc3a"

/**
 * The runtime of Solady's ERC-1967 beacon proxy (LibClone.initCodeERC1967BeaconProxy), which the factory deploys, and
 * where its init code reads the beacon's storage slot from: what makes a wallet's address.
 */
const BEACON_PROXY_RUNTIME =
  "0x363d3d373d3d363d602036600436635c60da1b60e01b36527fa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50545afa5036515af43d6000803e604d573d6000fd5b3d6000f3"

const BEACON_SLOT_OFFSET = 0x19

export {
  CREATE_PROXY_TYPES,
  OP_TYPES,
  PROXY_TTL_MS,
  SIGN_DOMAIN,
  PUSD,
  PERPS_WITHDRAW_DOMAIN,
  PERPS_WITHDRAW_TYPES,
  PERPS_WITHDRAW_FEE,
  BRIDGE_URL,
  DEPOSIT_WALLET_BATCH_SECONDS,
  DEPOSIT_WALLET_DOMAIN,
  DEPOSIT_WALLET_CHAIN_ID,
  DEPOSIT_WALLET_BATCH_TYPES,
  ERC20_TRANSFER_ABI,
  DEPOSIT_WALLET_FACTORY,
  DEPOSIT_WALLET_BEACON,
  BEACON_PROXY_RUNTIME,
  BEACON_SLOT_OFFSET,
}
