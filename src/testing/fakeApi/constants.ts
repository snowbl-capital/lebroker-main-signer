import { ApiRoute, RequestAction } from "../../api/enums"
import { DeploymentEnvironment } from "../../lebroker/core/model"
import { asterAgentName, hyperliquidAgentName } from "../../lebroker/venues/model"

const SESSION_COOKIE = "lebroker_session"

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** `/api/v1/signature-requests/<id>/sign`, as the service matches it. */
const SIGN_ROUTE = new RegExp(`^${ApiRoute.SIGNATURE_REQUESTS}/([A-Za-z0-9-]{1,64})/${RequestAction.SIGN}$`)

/** `/api/v1/signature-requests/<id>/decline`, as the service matches it. */
const DECLINE_ROUTE = new RegExp(`^${ApiRoute.SIGNATURE_REQUESTS}/([A-Za-z0-9-]{1,64})/${RequestAction.DECLINE}$`)

const SIGNATURE_REQUESTS_FRAME = 'event: signature-requests\ndata: {"type":"signature-requests"}\n\n'

/** The deployment's settings its deployment.js gives the web, as the executor writes them: production's agents' names. */
const DEPLOYMENT_SETTINGS = {
  apiUrl: "/api",
  hyperliquidAgentName: hyperliquidAgentName({ environment: DeploymentEnvironment.PROD }),
  asterAgentName: asterAgentName({ environment: DeploymentEnvironment.PROD }),
  mode: "executor",
}

export { DECLINE_ROUTE, DEPLOYMENT_SETTINGS, SESSION_COOKIE, SESSION_TTL_MS, SIGN_ROUTE, SIGNATURE_REQUESTS_FRAME }
