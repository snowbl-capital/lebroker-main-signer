import { encode } from "@msgpack/msgpack"
import { keccak256, type Hex } from "viem"
import { OP_TYPES, SIGN_DOMAIN } from "./constants"
import { PolymarketOp } from "./enums"
import type { CompactProps, DeleteProxyOpProps, OpHashProps, OpTypedDataProps, OpValue } from "./types"

/**
 * A command as Polymarket hashes it: every absent field dropped from its lists, at every depth, so the fields after
 * it move up. Polymarket rebuilds the same list from the command's named arguments.
 */
function compact({ value }: CompactProps): OpValue {
  if (!isList(value)) {
    return value
  }
  return value.filter(item => item !== undefined).map(item => compact({ value: item }))
}

function isList(value: OpValue): value is readonly OpValue[] {
  return Array.isArray(value)
}

/**
 * What a command's signature covers: the keccak-256 of its msgpack encoding. Polymarket's own clients encode with
 * @msgpack/msgpack's defaults, as Hyperliquid's signing here does: each integer in its smallest form, strings and
 * lists with their shortest headers, no floats (prices and sizes travel as decimal strings).
 */
function opHash({ op }: OpHashProps): Hex {
  return keccak256(encode(compact({ value: op })))
}

/** The typed data of a command: the hash of the command, a salt used once, and the time, in milliseconds. */
function opTypedData({ op, salt, ts }: OpTypedDataProps) {
  return {
    domain: SIGN_DOMAIN,
    types: OP_TYPES,
    primaryType: "Op" as const,
    message: { data: opHash({ op }), salt: BigInt(salt), ts: BigInt(ts) },
  }
}

/** The owner's deletion of a proxy, as its key signs it: the proxy alone, as Polymarket's own SDK writes it. */
function deleteProxyOp({ proxy }: DeleteProxyOpProps): readonly OpValue[] {
  return [PolymarketOp.DELETE_PROXY, [proxy]]
}

export { compact, deleteProxyOp, opHash, opTypedData }
