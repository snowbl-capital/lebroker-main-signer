import { deploymentName } from "../helpers/deploymentName/deploymentName"
import { AGENT_NAME, AGENT_NAME_SUFFIXES } from "./constants"
import { AsterAgentKind } from "./enums"
import type { AgentNameProps, AgentNamesProps } from "./types"

/**
 * lebroker's trading agent's name on a Main's Aster account, by deployment: production's plain `leneutre`, any other's
 * its own, as `leneutre-dev`. Aster keeps one agent per name on an account and an approval under a name replaces the
 * agent it held, so two deployments sharing one Main under one name would each revoke the other's agent.
 */
function agentName({ environment }: AgentNameProps): string {
  return deploymentName({ base: AGENT_NAME, environment })
}

/** Each of an owner's agents' names, by kind, from its trading agent's: `leneutre-dev-convert` beside `leneutre-dev`. */
function agentNames({ name }: AgentNamesProps): Record<AsterAgentKind, string> {
  return {
    [AsterAgentKind.TRADING]: `${name}${AGENT_NAME_SUFFIXES[AsterAgentKind.TRADING]}`,
    [AsterAgentKind.WITHDRAWAL]: `${name}${AGENT_NAME_SUFFIXES[AsterAgentKind.WITHDRAWAL]}`,
    [AsterAgentKind.CONVERT]: `${name}${AGENT_NAME_SUFFIXES[AsterAgentKind.CONVERT]}`,
  }
}

export { agentName, agentNames }
