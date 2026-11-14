import type { DeploymentEnvironment } from "../../../core/model"

/** The name production uses, and the deployment it's for. */
type DeploymentNameProps = { base: string; environment: DeploymentEnvironment }

export type { DeploymentNameProps }
