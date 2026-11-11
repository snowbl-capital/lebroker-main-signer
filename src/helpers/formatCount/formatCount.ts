import { LOCALE } from "../formatDate/constants"
import type { FormatCountProps } from "./types"

/** A whole number as lebroker's front shows it (the design system's `formatCount`, in its English locale): "18,000". */
function formatCount({ value }: FormatCountProps): string {
  return value.toLocaleString(LOCALE)
}

export { formatCount }
