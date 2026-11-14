import { DeploymentEnvironment } from "../lebroker/core/model"
import { asterAgentName, hyperliquidAgentName } from "../lebroker/venues/model"
import { DEPLOYMENT_GLOBAL } from "../lebroker/web/config/runtime/constants"
import { deploymentSettings } from "../lebroker/web/config/runtime/schema"
import { SESSION_COOKIES } from "./constants"
import { ApiErrorText } from "./enums"
import { ApiError } from "./errors"
import { errorBody } from "./schema"
import type { AgentNames, AgentNamesOfProps, ReadProps, SessionCookieProps } from "./types"

/** An answer read against its schema; a refusal throws lebroker's own words and status. */
async function readAnswer<T>({ response, schema }: ReadProps<T>): Promise<T> {
  const answer: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const refused = errorBody.safeParse(answer)
    throw new ApiError({ message: refused.success ? refused.data.error : ApiErrorText.FAILED, status: response.status })
  }
  const parsed = schema.safeParse(answer)
  if (!parsed.success) {
    throw new ApiError({ message: ApiErrorText.UNEXPECTED, status: response.status })
  }
  return parsed.data
}

/** The session's cookie, `name=value`, as a sign-in sets it; null when it sets none. */
function sessionCookie({ response }: SessionCookieProps): string | null {
  const pair = response.headers
    .getSetCookie()
    .map(cookie => cookie.split(";")[0]?.trim() ?? "")
    .find(cookie => SESSION_COOKIES.some(name => cookie.startsWith(`${name}=`) && cookie.length > name.length + 1))
  return pair ?? null
}

/**
 * This deployment's agents' names, read from its deployment.js as the web reads them (`resolveRuntime`): the
 * deployment's, or where it names none, a local executor's, as the web's own defaults. A script that isn't the
 * executor's assignment of its settings throws: nothing is read from it.
 */
function agentNamesOf({ script }: AgentNamesOfProps): AgentNames {
  const prefix = `window.${DEPLOYMENT_GLOBAL} = `
  const text = script.trim()
  if (!text.startsWith(prefix)) {
    throw new ApiError({ message: ApiErrorText.NOT_DEPLOYMENT, status: null })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(prefix.length))
  } catch {
    throw new ApiError({ message: ApiErrorText.NOT_DEPLOYMENT, status: null })
  }
  const deployed = deploymentSettings.parse(parsed)
  return {
    hyperliquidAgentName: deployed.hyperliquidAgentName.trim() || hyperliquidAgentName({ environment: DeploymentEnvironment.LOCAL }),
    asterAgentName: deployed.asterAgentName.trim() || asterAgentName({ environment: DeploymentEnvironment.LOCAL }),
  }
}

export { agentNamesOf, readAnswer, sessionCookie }
