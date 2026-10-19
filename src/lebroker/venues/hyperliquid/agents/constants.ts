/** lebroker's agent's name on every Main: it never changes, so each renewal replaces it and takes no second slot (D2). */
const LEBROKER_AGENT_NAME = "lebroker"

/** The longest an agent may last: 180 days was accepted, 181 refused (tested on mainnet, 18 October 2026). */
const AGENT_MAX_VALIDITY_MS = 180 * 24 * 60 * 60 * 1000

/** How an agent's end is written in its name: Hyperliquid reads `<name> valid_until <ms>`. */
const VALID_UNTIL = "valid_until"

export { AGENT_MAX_VALIDITY_MS, LEBROKER_AGENT_NAME, VALID_UNTIL }
