import type { DeploymentEnvironment } from "../../core/model"

/** The deployment an agent's name is for. */
type AgentNameProps = { environment: DeploymentEnvironment }

/** The trading agent's name, which every other agent's is made from. */
type AgentNamesProps = { name: string }

export type { AgentNameProps, AgentNamesProps }
