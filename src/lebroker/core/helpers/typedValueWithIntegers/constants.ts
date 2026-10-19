/** EIP-712's integer types: `uint8` to `uint256`, `int8` to `int256`. */
const INTEGER_TYPE = /^u?int\d*$/

/** An array type and the type of its items. */
const ARRAY_TYPE = /^(.+)\[\d*\]$/

export { ARRAY_TYPE, INTEGER_TYPE }
