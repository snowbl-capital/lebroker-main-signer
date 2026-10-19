// The Main signer: signs, on its user's own machine, the signature requests lebroker's hosted service asks of their Main
// wallets, and only those lebroker's allowlist accepts. `bun run main-signer` (README.md).
import { homedir } from "node:os"
import { createApiClient } from "./api/api"
import { readConfig } from "./config/config"
import { createLogger } from "./log/log"
import { createWalletSigner } from "./walletSigner/walletSigner"
import { loadWallets } from "./wallets/wallets"

async function main(): Promise<void> {
  const config = readConfig({ env: process.env, home: homedir() })
  const log = createLogger()
  const wallets = await loadWallets({ keysDir: config.keysDir, labels: config.labels })
  const signers = wallets.map(wallet =>
    createWalletSigner({
      wallet,
      client: createApiClient({ baseUrl: config.lebrokerUrl, wallet, chainId: config.chainId, log }),
      chainId: config.chainId,
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
