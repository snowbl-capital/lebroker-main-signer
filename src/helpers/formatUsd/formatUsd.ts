import { LOCALE } from "../formatDate/constants"
import { USD_FORMAT } from "./constants"
import type { FormatUsdProps } from "./types"

/**
 * Dollars as lebroker's front shows them (the design system's `formatUsd`, at its defaults, in its English locale), so
 * the mirrored allowlist's summaries read the same here: "$0.15".
 */
function formatUsd({ value }: FormatUsdProps): string {
  return value.toLocaleString(LOCALE, USD_FORMAT)
}

export { formatUsd }
