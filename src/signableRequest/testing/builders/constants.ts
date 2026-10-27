import { ASTER_AGENT_NAME, ASTER_CONVERT_AGENT_NAME } from "../../../lebroker/venues/model"
import { AsterAgentKind } from "./enums"

/** Hyperliquid's amounts on the wire: at most this many decimals, trailing zeros dropped. */
const WIRE_DECIMALS = 8

/** lebroker's Aster agent that only withdraws: Main's allowlist never signs its approval. */
const ASTER_WITHDRAWAL_AGENT_NAME = "lebroker-withdraw"

/** Each of lebroker's Aster agents' names, by what it does, as lebroker's `AGENT_NAMES` gives them. */
const ASTER_AGENT_NAMES: Record<AsterAgentKind, string> = {
  [AsterAgentKind.TRADING]: ASTER_AGENT_NAME,
  [AsterAgentKind.WITHDRAWAL]: ASTER_WITHDRAWAL_AGENT_NAME,
  [AsterAgentKind.CONVERT]: ASTER_CONVERT_AGENT_NAME,
}

export { ASTER_AGENT_NAMES, WIRE_DECIMALS }
