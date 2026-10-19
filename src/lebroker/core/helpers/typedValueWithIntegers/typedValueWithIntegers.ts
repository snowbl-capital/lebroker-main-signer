import { isRecord } from "../isRecord/isRecord"
import { ARRAY_TYPE, INTEGER_TYPE } from "./constants"
import type { TypedValueWithIntegersProps } from "./types"

/**
 * A typed message's value as viem hashes it: JSON carries integers as numbers or decimal strings, viem takes bigints.
 * Through structs and arrays as the types say. A struct's fields the types don't name are left out, as EIP-712 hashes
 * only the named ones; a value of another shape than its type is left as it is.
 */
function typedValueWithIntegers({ types, type, value }: TypedValueWithIntegersProps): unknown {
  const fields = types[type]
  if (fields !== undefined) {
    if (!isRecord(value)) {
      return value
    }
    return Object.fromEntries(
      fields.map(field => [field.name, typedValueWithIntegers({ types, type: field.type, value: value[field.name] })]),
    )
  }
  const item = ARRAY_TYPE.exec(type)?.[1]
  if (item !== undefined) {
    return Array.isArray(value) ? value.map((entry: unknown) => typedValueWithIntegers({ types, type: item, value: entry })) : value
  }
  if (INTEGER_TYPE.test(type) && (typeof value === "number" || typeof value === "string")) {
    return BigInt(value)
  }
  return value
}

export { typedValueWithIntegers }
