import { LOCALE } from "./constants"
import type { FormatDateProps } from "./types"

/**
 * A date and time as lebroker's front shows it (the design system's `formatDate`, in its English locale), so the
 * mirrored allowlist's summaries read the same here: "19 Oct 2026, 14:05:00", in this machine's time zone.
 */
function formatDate({ iso }: FormatDateProps): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "medium" })
}

export { formatDate }
