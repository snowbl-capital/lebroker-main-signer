import { deploymentName } from "../../helpers/deploymentName/deploymentName"
import { LENEUTRE_AGENT_NAME } from "./constants"
import type { AgentNameProps } from "./types"

/**
 * lebroker's agent's name on a Main, by deployment: production's `leneutre`, any other's its own, as `leneutre-dev`.
 * Hyperliquid keeps one agent per name and replaces it when another is approved under that name, so two deployments
 * sharing one would each undo the other's agent on the same Main, which reads as set up and has every order refused.
 */
function agentName({ environment }: AgentNameProps): string {
  return deploymentName({ base: LENEUTRE_AGENT_NAME, environment })
}

export { agentName }
