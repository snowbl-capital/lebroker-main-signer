import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { inspect } from "node:util"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { WalletError } from "./enums"
import { loadWallets } from "./wallets"

const folders: string[] = []

afterEach(async () => {
  await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true })))
})

/** A folder of throwaway key files, each its owner's only. */
async function keysDir(files: Record<string, string>): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "main-signer-keys-"))
  folders.push(folder)
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(folder, name), content, { mode: 0o600 })
  }
  return folder
}

describe("a folder of key files", () => {
  test("gives one wallet per <label>.key file, with or without 0x, other and hidden files left alone", async () => {
    const main = generatePrivateKey()
    const sec = generatePrivateKey()
    const folder = await keysDir({ "main.key": `${main}\n`, "sec.key": sec.slice(2), "notes.txt": "hello", ".swap.key": "x" })
    const wallets = await loadWallets({ keysDir: folder, labels: null })
    expect(wallets.map(wallet => wallet.info)).toEqual([
      { label: "main", address: privateKeyToAccount(main).address },
      { label: "sec", address: privateKeyToAccount(sec).address },
    ])
  })

  test("keeps each key out of logs, JSON and inspection", async () => {
    const key = generatePrivateKey()
    const wallets = await loadWallets({ keysDir: await keysDir({ "main.key": key }), labels: null })
    const shown = `${JSON.stringify(wallets)} ${inspect(wallets)} ${String(wallets[0])}`
    expect(shown).not.toContain(key.slice(2))
  })

  test("runs only the wallets MAIN_WALLETS names, and refuses one it has no file for", async () => {
    const folder = await keysDir({ "main.key": generatePrivateKey(), "sec.key": generatePrivateKey() })
    expect((await loadWallets({ keysDir: folder, labels: ["sec"] })).map(wallet => wallet.info.label)).toEqual(["sec"])
    expect(loadWallets({ keysDir: folder, labels: ["third"] })).rejects.toThrow(`${WalletError.UNKNOWN_LABEL} third`)
  })

  test("stops on a malformed key, naming its label and never its content", async () => {
    const folder = await keysDir({ "main.key": "not-a-key-0123" })
    const refused = await loadWallets({ keysDir: folder, labels: null }).catch((error: unknown) => error)
    expect(refused instanceof Error ? refused.message : "").toBe(`${WalletError.FILE_KEY_MALFORMED} main`)
  })

  test("stops on two files of one wallet, an empty folder, a missing folder and a folder in place of a file", async () => {
    const key = generatePrivateKey()
    expect(loadWallets({ keysDir: await keysDir({ "a.key": key, "b.key": key }), labels: null })).rejects.toThrow(
      `${WalletError.DUPLICATE} a, b`,
    )
    expect(loadWallets({ keysDir: await keysDir({}), labels: null })).rejects.toThrow(WalletError.KEYS_DIR_EMPTY)
    expect(loadWallets({ keysDir: join(tmpdir(), "main-signer-no-such-folder"), labels: null })).rejects.toThrow(
      WalletError.KEYS_DIR_UNREADABLE,
    )
    const withFolder = await keysDir({})
    await mkdir(join(withFolder, "main.key"))
    expect(loadWallets({ keysDir: withFolder, labels: null })).rejects.toThrow(`${WalletError.KEY_FILE_NOT_FILE} main`)
  })

  test("refuses a key file others can read, where permission bits say who reads", async () => {
    const folder = await keysDir({ "main.key": generatePrivateKey() })
    await chmod(join(folder, "main.key"), 0o644)
    expect(loadWallets({ keysDir: folder, labels: null, platform: "linux" })).rejects.toThrow(`${WalletError.KEY_FILE_SHARED} main`)
  })
})
