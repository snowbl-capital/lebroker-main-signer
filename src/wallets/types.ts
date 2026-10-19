import type { Address, Hex } from "viem"

/** A wallet as the logs name it: its label and its address, both public. */
type WalletInfo = { label: string; address: Address }

type WalletKeyProps = { key: Hex; label: string }

type LoadWalletsProps = {
  keysDir: string
  /** The wallets to run, by label; null for all of the folder's. */
  labels: readonly string[] | null
  platform?: NodeJS.Platform
}

type ReadKeysDirProps = { keysDir: string; platform: NodeJS.Platform }

type ReadKeyFileProps = { keysDir: string; name: string; platform: NodeJS.Platform }

type ParseKeyProps = { raw: string; error: string }

type LabelProps = { label: string }

type DistinctWalletsProps<T extends { info: WalletInfo }> = { wallets: T[]; error: string }

export type {
  DistinctWalletsProps,
  LabelProps,
  LoadWalletsProps,
  ParseKeyProps,
  ReadKeyFileProps,
  ReadKeysDirProps,
  WalletInfo,
  WalletKeyProps,
}
