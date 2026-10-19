/** Hyperliquid's amounts on the wire: at most this many decimals, trailing zeros dropped. */
const WIRE_DECIMALS = 8

/** lebroker's Aster agent that only withdraws: Main's allowlist never signs its approval. */
const ASTER_WITHDRAWAL_AGENT_NAME = "lebroker-withdraw"

export { ASTER_WITHDRAWAL_AGENT_NAME, WIRE_DECIMALS }
