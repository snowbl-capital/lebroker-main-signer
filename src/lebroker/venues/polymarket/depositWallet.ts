import { concat, encodeAbiParameters, getCreate2Address, keccak256, numberToHex, pad, size, type Address } from "viem"
import {
  BEACON_PROXY_RUNTIME,
  BEACON_SLOT_OFFSET,
  DEPOSIT_WALLET_BATCH_TYPES,
  DEPOSIT_WALLET_BEACON,
  DEPOSIT_WALLET_CHAIN_ID,
  DEPOSIT_WALLET_DOMAIN,
  DEPOSIT_WALLET_FACTORY,
} from "./constants"
import type { DepositWalletBatchProps, DepositWalletOfProps } from "./types"

/**
 * The owner's Deposit Wallet, as Polymarket's factory deploys it: a Solady ERC-1967 beacon proxy cloned with CREATE2,
 * its arguments the factory and the owner as a 32-byte id, its salt their hash. Derived offline, deployed or not, so a
 * browser derives it as the service does.
 */
function depositWalletOf({ owner }: DepositWalletOfProps): Address {
  const args = encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [DEPOSIT_WALLET_FACTORY, pad(owner, { size: 32 })])
  const runtime = concat([BEACON_PROXY_RUNTIME, args])
  // Solady's LibClone.initCodeERC1967BeaconProxy: it stores the beacon in its slot, then returns the runtime and args.
  const init = concat([
    "0x61",
    numberToHex(size(runtime), { size: 2 }),
    "0x3d8160233d3973",
    DEPOSIT_WALLET_BEACON,
    "0x60",
    numberToHex(BEACON_SLOT_OFFSET, { size: 1 }),
    "0x5155f3",
    runtime,
  ])
  return getCreate2Address({ from: DEPOSIT_WALLET_FACTORY, salt: keccak256(args), bytecode: init })
}

/**
 * A Deposit Wallet's batch as its owner signs it (EIP-712 `Batch`, the wallet its own verifying contract, on Polygon):
 * what Polymarket's relayer sends for the wallet, its gas paid by the relayer. `nonce` is the relayer's for the owner,
 * `deadline` in seconds.
 */
function depositWalletBatchTypedData({ wallet, nonce, deadline, calls }: DepositWalletBatchProps) {
  return {
    domain: { ...DEPOSIT_WALLET_DOMAIN, chainId: DEPOSIT_WALLET_CHAIN_ID, verifyingContract: wallet },
    types: DEPOSIT_WALLET_BATCH_TYPES,
    primaryType: "Batch" as const,
    message: { wallet, nonce, deadline, calls },
  }
}

export { depositWalletOf, depositWalletBatchTypedData }
