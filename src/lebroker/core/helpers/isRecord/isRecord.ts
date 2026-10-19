/** Whether a value is a plain object, read by its keys: neither null nor an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export { isRecord }
