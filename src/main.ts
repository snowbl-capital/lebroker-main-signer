// The Main signer: signs, on its user's own machine, the signature requests lebroker's hosted service asks of their Main
// wallets, and only those lebroker's allowlist accepts. `bun run main-signer` (README.md).
import { homedir } from "node:os"
import { openAddressBookRecord } from "./addressBookRecord/addressBookRecord"
import { createApiClient } from "./api/api"
import { readConfig } from "./config/config"
import { createLogger } from "./log/log"
import { createWalletSigner } from "./walletSigner/walletSigner"
import { loadWallets } from "./wallets/wallets"

async function main(): Promise<void> {
  const config = readConfig({ env: process.env, home: homedir() })
  const log = createLogger()
  const wallets = await loadWallets({ keysDir: config.keysDir, labels: config.labels })
  // The address-book entries checked on earlier runs (lebroker's D70), for this deployment: a withdrawal seen once holds.
  const record = await openAddressBookRecord({ path: config.addressBookFile, deployment: config.lebrokerUrl.host })
  const signers = wallets.map(wallet =>
    createWalletSigner({
      wallet,
      client: createApiClient({ baseUrl: config.lebrokerUrl, wallet, chainId: config.chainId, log }),
      chainId: config.chainId,
      appOrigin: config.lebrokerUrl.origin,
      record,
      log,
    }),
  )
  for (const signer of signers) {
    signer.start()
  }
  let stopping = false
  function stop(): void {
    if (stopping) {
      return
    }
    stopping = true
    void Promise.all(signers.map(signer => signer.stop())).then(() => process.exit(0))
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}

main().catch((error: unknown) => {
  // Our own words only: every error of the start is written never to quote a key.
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
