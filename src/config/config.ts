import { join } from "node:path"
import { ADDRESS_BOOK_RECORD_FILE } from "../addressBookRecord/constants"
import { isWalletLabel, labelSaid } from "../wallets/wallets"
import { HTTP_PROTOCOL, HTTPS_PROTOCOL, LABEL_SEPARATOR, LOOPBACK_HOSTNAMES, LOOPBACK_IPV4 } from "./constants"
import { ConfigError, EnvName } from "./enums"
import type { ChainIdProps, Config, ExpandHomeProps, HostnameProps, LabelsProps, ReadConfigProps, UrlProps } from "./types"

function isLoopback({ hostname }: HostnameProps): boolean {
  return LOOPBACK_HOSTNAMES.includes(hostname) || LOOPBACK_IPV4.test(hostname)
}

/** The service's address: https anywhere, plain http on this machine only, where nothing else reads the wire. */
function serviceUrl({ raw }: UrlProps): URL {
  if (raw === "") {
    throw new Error(ConfigError.URL_MISSING)
  }
  const url = URL.parse(raw)
  if (url === null || (url.protocol !== HTTP_PROTOCOL && url.protocol !== HTTPS_PROTOCOL)) {
    throw new Error(ConfigError.URL_MALFORMED)
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error(ConfigError.URL_WITH_CREDENTIALS)
  }
  if (url.protocol === HTTP_PROTOCOL && !isLoopback({ hostname: url.hostname })) {
    throw new Error(`${ConfigError.URL_NOT_LOOPBACK} ${url.hostname}`)
  }
  return new URL(url.origin)
}

/** A shell leaves `~` as it is in some places, such as after `=` in a quoted value: read as the user's home. */
function expandHome({ path, home }: ExpandHomeProps): string {
  if (path === "~") {
    return home
  }
  return path.startsWith("~/") || path.startsWith("~\\") ? join(home, path.slice(2)) : path
}

function labels({ raw }: LabelsProps): string[] | null {
  const listed = raw
    .split(LABEL_SEPARATOR)
    .map(label => label.trim())
    .filter(label => label !== "")
  if (listed.length === 0) {
    return null
  }
  const malformed = listed.find(label => !isWalletLabel({ label }))
  if (malformed !== undefined) {
    throw new Error(`${ConfigError.WALLET_LABEL_MALFORMED} ${labelSaid({ label: malformed })}`)
  }
  return [...new Set(listed)]
}

function chainId({ raw }: ChainIdProps): number | null {
  if (raw === "") {
    return null
  }
  if (!/^\d{1,15}$/.test(raw) || Number(raw) === 0) {
    throw new Error(ConfigError.CHAIN_ID_MALFORMED)
  }
  return Number(raw)
}

/** The signer's settings, from the environment: anything doubtful stops the start, never quoting a key. */
function readConfig({ env, home }: ReadConfigProps): Config {
  const keysDir = (env[EnvName.MAIN_KEYS_DIR] ?? "").trim()
  const lebrokerUrl = serviceUrl({ raw: (env[EnvName.LEBROKER_URL] ?? "").trim() })
  if (keysDir === "") {
    throw new Error(ConfigError.KEYS_DIR_MISSING)
  }
  const keysPath = expandHome({ path: keysDir, home })
  const addressBookFile = (env[EnvName.MAIN_ADDRESS_BOOK_FILE] ?? "").trim()
  return {
    lebrokerUrl,
    keysDir: keysPath,
    labels: labels({ raw: env[EnvName.MAIN_WALLETS] ?? "" }),
    chainId: chainId({ raw: (env[EnvName.MAIN_CHAIN_ID] ?? "").trim() }),
    addressBookFile: addressBookFile === "" ? join(keysPath, ADDRESS_BOOK_RECORD_FILE) : expandHome({ path: addressBookFile, home }),
  }
}

export { readConfig }
