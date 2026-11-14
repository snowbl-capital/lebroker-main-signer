// The web's `fetchApi` (`apps/web/src/helpers/fetchApi/fetchApi.ts`), for the helpers this signer copies whole: a read
// of lebroker's API under the signing wallet's own session, not the browser's cookie. Written after lebroker's code,
// not a copy: `mirror:check` doesn't check it.
import { ApiErrorText } from "../../../../api/enums"
import { ApiError } from "../../../../api/errors"
import { readAnswer } from "../../../../api/utils"
import { API_SCOPE, DEFAULT_API_URL } from "./constants"
import type { FetchApiProps, WithApiScopeProps } from "./types"

/**
 * A read of lebroker's API, its answer checked against its schema; a refusal throws lebroker's own words and status.
 * Under a wallet's scope, its session's; outside one, the web's default address, relative to a page no runtime here
 * has, which fails: nothing is read.
 */
async function fetchApi<T>({ path, schema }: FetchApiProps<T>): Promise<T> {
  const scope = API_SCOPE.getStore()
  const response = await (scope === undefined ? fetch(`${DEFAULT_API_URL}${path}`) : scope.get({ path })).catch((error: unknown) => {
    throw error instanceof ApiError ? error : new ApiError({ message: ApiErrorText.UNREACHABLE, status: null })
  })
  return readAnswer({ response, schema })
}

/** Runs `run` with every `fetchApi` it makes, however deep, under the wallet's session `scope`. */
function withApiScope<T>({ scope, run }: WithApiScopeProps<T>): Promise<T> {
  return API_SCOPE.run(scope, run)
}

export { fetchApi, withApiScope }
