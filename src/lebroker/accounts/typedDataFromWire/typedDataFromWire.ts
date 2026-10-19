import { isRecord, typedValueWithIntegers } from "../../core/model"
import type { TypedDataDefinition, TypedDataParameter } from "viem"
import type { TypedDataFromWireProps } from "./types"

/** Typed data as `wireTypedData` wrote it, its integers bigints again: what viem hashes and recovers the signer of. */
function typedDataFromWire({
  payload,
}: TypedDataFromWireProps): TypedDataDefinition<Record<string, readonly TypedDataParameter[]>, string> {
  const chainId = payload.domain.chainId
  const message = typedValueWithIntegers({ types: payload.types, type: payload.primaryType, value: payload.message })
  return {
    domain: {
      ...payload.domain,
      ...(typeof chainId === "string" || typeof chainId === "number" ? { chainId: BigInt(chainId) } : {}),
    },
    types: payload.types,
    primaryType: payload.primaryType,
    message: isRecord(message) ? message : {},
  }
}

export { typedDataFromWire }
