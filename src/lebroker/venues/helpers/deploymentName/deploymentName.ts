import { DeploymentEnvironment } from "../../../core/model"
import type { DeploymentNameProps } from "./types"

/**
 * A name lebroker's keys take on a Main's venue account, by deployment: production's the plain one, any other's its own,
 * as `leneutre-dev`. A venue that keeps one agent or proxy per name replaces it under the same name, so two
 * deployments sharing one Main would each undo the other's.
 */
function deploymentName({ base, environment }: DeploymentNameProps): string {
  return environment === DeploymentEnvironment.PROD ? base : `${base}-${environment}`
}

export { deploymentName }
