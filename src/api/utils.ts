import { SESSION_COOKIES } from "./constants"
import { ApiErrorText } from "./enums"
import { ApiError } from "./errors"
import { errorBody } from "./schema"
import type { ReadProps, SessionCookieProps } from "./types"

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

export { readAnswer, sessionCookie }
