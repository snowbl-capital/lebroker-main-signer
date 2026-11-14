import type { Address, Hex } from "viem"

/** A value of a command as it is signed: positional, an absent field `undefined`. */
type OpValue = boolean | number | string | undefined | readonly OpValue[]

type OpHashProps = { op: OpValue }

type CompactProps = { value: OpValue }

type OpTypedDataProps = { op: readonly OpValue[]; salt: number; ts: number }

type DeleteProxyOpProps = { proxy: Address }

type DepositWalletOfProps = { owner: Address }

/** One call of a Deposit Wallet's batch: its contract, the native value it sends, and its call data. */
type DepositWalletCall = { target: Address; value: bigint; data: Hex }

/** A Deposit Wallet's batch: the relayer's nonce for the owner, its deadline in seconds, and its calls. */
type DepositWalletBatchProps = { wallet: Address; nonce: bigint; deadline: bigint; calls: readonly DepositWalletCall[] }

export type {
  CompactProps,
  DeleteProxyOpProps,
  OpHashProps,
  OpTypedDataProps,
  OpValue,
  DepositWalletOfProps,
  DepositWalletCall,
  DepositWalletBatchProps,
}
