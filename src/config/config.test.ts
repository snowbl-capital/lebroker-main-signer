import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { readConfig } from "./config"
import { ConfigError } from "./enums"

const HOME = join("/", "home", "owner")

function read(env: Record<string, string>) {
  return readConfig({ env: { MAIN_KEYS_DIR: "~/wts", ...env }, home: HOME })
}

describe("LEBROKER_URL", () => {
  test("takes plain http on this machine only", () => {
    for (const url of ["http://127.0.0.1:8190", "http://localhost:8190", "http://[::1]:8190", "http://127.0.0.2"]) {
      expect(read({ LEBROKER_URL: url }).lebrokerUrl.protocol).toBe("http:")
    }
    expect(() => read({ LEBROKER_URL: "http://192.168.1.20:8190" })).toThrow(ConfigError.URL_NOT_LOOPBACK)
    expect(() => read({ LEBROKER_URL: "http://lebroker.example" })).toThrow(ConfigError.URL_NOT_LOOPBACK)
  })

  test("takes https anywhere, as its origin alone", () => {
    expect(read({ LEBROKER_URL: "https://lebroker.example/app/" }).lebrokerUrl.href).toBe("https://lebroker.example/")
  })

  test("refuses another scheme, credentials and nothing at all", () => {
    expect(() => read({ LEBROKER_URL: "ws://127.0.0.1:8190" })).toThrow(ConfigError.URL_MALFORMED)
    expect(() => read({ LEBROKER_URL: "https://me:secret@lebroker.example" })).toThrow(ConfigError.URL_WITH_CREDENTIALS)
    expect(() => read({})).toThrow(ConfigError.URL_MISSING)
  })
})

describe("the wallets", () => {
  test("come from MAIN_KEYS_DIR, `~` read as the home folder", () => {
    expect(read({ LEBROKER_URL: "http://127.0.0.1:8190" }).keysDir).toBe(join(HOME, "wts"))
    expect(() => readConfig({ env: { LEBROKER_URL: "http://127.0.0.1:8190" }, home: HOME })).toThrow(ConfigError.KEYS_DIR_MISSING)
  })

  test("are all of the folder's, or those MAIN_WALLETS names", () => {
    expect(read({ LEBROKER_URL: "http://127.0.0.1:8190" }).labels).toBeNull()
    expect(read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_WALLETS: "main, sec,main" }).labels).toEqual(["main", "sec"])
    expect(() => read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_WALLETS: "Main" })).toThrow(ConfigError.WALLET_LABEL_MALFORMED)
  })

  test("never say back a value too long to be a label", () => {
    const pasted = "ab".repeat(32)
    expect(() => read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_WALLETS: pasted })).not.toThrow(pasted)
  })
})

describe("MAIN_CHAIN_ID", () => {
  test("is a positive whole number, or none", () => {
    expect(read({ LEBROKER_URL: "http://127.0.0.1:8190" }).chainId).toBeNull()
    expect(read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_CHAIN_ID: "10" }).chainId).toBe(10)
    expect(() => read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_CHAIN_ID: "0" })).toThrow(ConfigError.CHAIN_ID_MALFORMED)
    expect(() => read({ LEBROKER_URL: "http://127.0.0.1:8190", MAIN_CHAIN_ID: "0x1" })).toThrow(ConfigError.CHAIN_ID_MALFORMED)
  })
})
