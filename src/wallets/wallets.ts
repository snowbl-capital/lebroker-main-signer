import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { inspect } from "node:util"
import type { Hex, LocalAccount } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  KEY_FILE_EXTENSION,
  MAX_LABEL_LENGTH,
  PLATFORMS_WITHOUT_MODE_BITS,
  PRIVATE_KEY_PATTERN,
  SHARED_MODE_BITS,
  WALLET_LABEL_PATTERN,
} from "./constants"
import { WalletError } from "./enums"
import type {
  DistinctWalletsProps,
  LabelProps,
  LoadWalletsProps,
  ParseKeyProps,
  ReadKeyFileProps,
  ReadKeysDirProps,
  WalletInfo,
  WalletKeyProps,
} from "./types"

/**
 * One Main wallet's key, as the start read it. Its address and label are public; the key stays in an ES private field,
 * which no log, JSON or inspection shows, and leaves only as the account that signs for this wallet.
 */
class WalletKey {
  readonly info: WalletInfo
  readonly #key: Hex

  constructor({ key, label }: WalletKeyProps) {
    this.#key = key
    this.info = { address: privateKeyToAccount(key).address, label }
  }

  /** The account that signs for this wallet: its sign-ins and its allowed requests, nothing else. */
  account(): LocalAccount {
    return privateKeyToAccount(this.#key)
  }

  /** What a log line holds of it: its label. */
  toJSON(): Pick<WalletInfo, "label"> {
    return { label: this.info.label }
  }

  [inspect.custom](): string {
    return `WalletKey(${this.info.label})`
  }
}

function isWalletLabel({ label }: LabelProps): boolean {
  return WALLET_LABEL_PATTERN.test(label)
}

/**
 * A malformed label as an error says it back: as written when it's no longer than a label can be, and not at all past
 * that. What's longer is no mistyped label, and may be a key pasted in the label's place: it would reach the logs.
 */
function labelSaid({ label }: LabelProps): string {
  return label.length <= MAX_LABEL_LENGTH ? label : WalletError.LABEL_NOT_SAID
}

/**
 * The key as viem takes it, 0x and its 64 hex digits; anything else stops the start with the error given. So do 32
 * bytes that are no key on the curve, zero or past its order: the curve's own error would quote them.
 */
function parseKey({ raw, error }: ParseKeyProps): Hex {
  if (!PRIVATE_KEY_PATTERN.test(raw)) {
    throw new Error(error)
  }
  const key: Hex = raw.startsWith("0x") ? `0x${raw.slice(2)}` : `0x${raw}`
  try {
    privateKeyToAccount(key)
  } catch {
    throw new Error(error)
  }
  return key
}

/** The wallets as read, once each: two entries of one wallet stop the start, named by their labels. */
function distinctWallets<T extends { info: WalletInfo }>({ wallets, error }: DistinctWalletsProps<T>): T[] {
  wallets.forEach((wallet, index) => {
    const same = wallets.slice(0, index).find(other => other.info.address === wallet.info.address)
    if (same !== undefined) {
      throw new Error(`${error} ${same.info.label}, ${wallet.info.label}`)
    }
  })
  return wallets
}

async function readKeyFile({ keysDir, name, platform }: ReadKeyFileProps): Promise<WalletKey> {
  const label = name.slice(0, -KEY_FILE_EXTENSION.length)
  if (!isWalletLabel({ label })) {
    throw new Error(`${WalletError.LABEL_MALFORMED} ${labelSaid({ label })}`)
  }
  const path = join(keysDir, name)
  // The file system's own errors name the file's path: said in our words instead, by the wallet's label.
  const unreadable = (): never => {
    throw new Error(`${WalletError.DIR_KEY_FILE_UNREADABLE} ${label}`)
  }
  // Followed through a link, as secret stores mount their files.
  const stats = await stat(path).catch(unreadable)
  if (!stats.isFile()) {
    throw new Error(`${WalletError.KEY_FILE_NOT_FILE} ${label}`)
  }
  // Where the bits say nothing, they'd refuse every file and prove nothing: who reads it is the system's access list.
  if (!PLATFORMS_WITHOUT_MODE_BITS.includes(platform) && (stats.mode & SHARED_MODE_BITS) !== 0) {
    throw new Error(`${WalletError.KEY_FILE_SHARED} ${label}`)
  }
  const raw = (await readFile(path, "utf8").catch(unreadable)).trim()
  return new WalletKey({ key: parseKey({ raw, error: `${WalletError.FILE_KEY_MALFORMED} ${label}` }), label })
}

/**
 * One wallet per `<label>.key` file, as lebroker's executor read its WALLET_KEYS_DIR. Unlike there, no cap on how many:
 * the executor's came from each wallet's venue connections, and this signer opens none.
 */
async function readKeysDir({ keysDir, platform }: ReadKeysDirProps): Promise<WalletKey[]> {
  let names: string[] = []
  try {
    names = await readdir(keysDir)
  } catch {
    throw new Error(WalletError.KEYS_DIR_UNREADABLE)
  }
  // Hidden entries are the secret store's own (a mount's bookkeeping, an editor's swap file), never a wallet's.
  const keyFiles = names.filter(name => name.endsWith(KEY_FILE_EXTENSION) && !name.startsWith(".")).sort()
  if (keyFiles.length === 0) {
    throw new Error(WalletError.KEYS_DIR_EMPTY)
  }
  const wallets: WalletKey[] = []
  for (const name of keyFiles) {
    wallets.push(await readKeyFile({ keysDir, name, platform }))
  }
  return distinctWallets({ wallets, error: WalletError.DUPLICATE })
}

/**
 * The Main wallets this signer runs: every key file of the folder, or those MAIN_WALLETS names. A name without its
 * file stops the start, as anything doubtful does, never naming a key. Only the named files are read.
 */
async function loadWallets({ keysDir, labels, platform = process.platform }: LoadWalletsProps): Promise<WalletKey[]> {
  if (labels === null) {
    return readKeysDir({ keysDir, platform })
  }
  let names: string[] = []
  try {
    names = await readdir(keysDir)
  } catch {
    throw new Error(WalletError.KEYS_DIR_UNREADABLE)
  }
  const missing = labels.find(label => !names.includes(`${label}${KEY_FILE_EXTENSION}`))
  if (missing !== undefined) {
    throw new Error(`${WalletError.UNKNOWN_LABEL} ${missing}`)
  }
  const wallets: WalletKey[] = []
  for (const label of labels) {
    wallets.push(await readKeyFile({ keysDir, name: `${label}${KEY_FILE_EXTENSION}`, platform }))
  }
  return distinctWallets({ wallets, error: WalletError.DUPLICATE })
}

export { WalletKey, isWalletLabel, labelSaid, loadWallets, parseKey }
