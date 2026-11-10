import { POLYMARKET_BRIDGE_URL, PolymarketBridgePath, polymarketDepositWalletOf } from "../../../venues/model"
import { getAddress } from "viem"
import { BRIDGE_TIMEOUT_MS } from "./constants"
import { PolymarketBridgeAddressError } from "./enums"
import { bridgeWithdrawal } from "./schema"
import type { PolymarketBridgeAddressProps } from "./types"

/**
 * The address Polymarket's bridge pays a recipient from, for Main's own Deposit Wallet, derived here from Main's address,
 * asked of the bridge by the browser itself: the same address for the same wallet, chain, token and recipient. The
 * service's word for it is never taken. A read that fails throws: nothing is signed.
 */
async function polymarketBridgeAddress({ main, recipient, chainId, token }: PolymarketBridgeAddressProps): Promise<string> {
  const wallet = polymarketDepositWalletOf({ owner: getAddress(main) })
  const response = await fetch(`${POLYMARKET_BRIDGE_URL}${PolymarketBridgePath.WITHDRAW}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: wallet, toChainId: String(chainId), toTokenAddress: token, recipientAddr: recipient }),
    // The bridge's own answer only: a redirect elsewhere reads nothing.
    redirect: "error",
    signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
  }).catch(() => {
    throw new Error(PolymarketBridgeAddressError.UNREAD)
  })
  const answer: unknown = response.ok ? await response.json().catch(() => null) : null
  const parsed = bridgeWithdrawal.safeParse(answer)
  if (!parsed.success) {
    throw new Error(PolymarketBridgeAddressError.UNREAD)
  }
  return parsed.data.address.evm
}

export { polymarketBridgeAddress }
