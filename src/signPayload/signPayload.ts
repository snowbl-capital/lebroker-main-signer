import type { Hex } from "viem"
import { SignaturePayloadKind, typedDataFromWire } from "../lebroker/accounts/model"
import { SignPayloadError } from "./enums"
import type { SignPayloadProps } from "./types"

/**
 * Main signs a payload the allowlist accepted, as the browser's wallet would: a personal message as it is, typed data
 * with its integers bigints again, on the one chain its allowlist names and never another (the web's `signPayload`,
 * without the wallet's connection and chain switch, which a key in hand doesn't have).
 */
async function signPayload({ account, payload, chainId }: SignPayloadProps): Promise<Hex> {
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return account.signMessage({ message: payload.message })
  }
  const typedData = typedDataFromWire({ payload: payload.typedData })
  if (chainId === null || Number(typedData.domain?.chainId) !== chainId) {
    throw new Error(SignPayloadError.NOT_ALLOWED_CHAIN)
  }
  return account.signTypedData(typedData)
}

export { signPayload }
