/** EIP-712's types: each struct's name, and its fields in order. */
type TypedDataTypes = Record<string, readonly { name: string; type: string }[]>

type TypedValueWithIntegersProps = {
  types: TypedDataTypes
  /** The value's EIP-712 type: a struct's name, an array of a type, or an atom. */
  type: string
  value: unknown
}

export type { TypedDataTypes, TypedValueWithIntegersProps }
