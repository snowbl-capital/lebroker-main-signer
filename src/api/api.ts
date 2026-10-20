import { createSiweMessage } from "viem/siwe"
import { LogEvent, SessionStage } from "../log/enums"
import { MAIN_SIGNER_RESOURCE } from "../lebroker/accounts/constants"
import { accountsList } from "../lebroker/web/hooks/accounts/useAccountsQueryList/schema"
import { issuedNonce } from "../lebroker/web/hooks/session/useSessionMutationSignIn/schema"
import { SIGN_IN_STATEMENT, SIGN_IN_TTL_MS } from "../lebroker/web/hooks/session/useSessionMutationSignIn/constants"
import { requestAnswer, signatureRequestsList } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/schema"
import { EVENT_STREAM_CONTENT_TYPE, JSON_CONTENT_TYPE, SIGN_IN_DEFAULT_CHAIN_ID, SIWE_VERSION } from "./constants"
import { ApiErrorText, ApiRoute, HttpMethod, RequestAction } from "./enums"
import { ApiError } from "./errors"
import { sessionBody } from "./schema"
import type { ApiClient, CallProps, CreateApiClientProps, Session } from "./types"
import { readAnswer, sessionCookie } from "./utils"

/**
 * One Main wallet's client of lebroker's hosted service, signed in as the web app signs in (Sign-In with Ethereum: a
 * fresh nonce from the service, a message naming the service's own host, the wallet's signature), its session kept in
 * its cookie. A call the service answers 401, its session gone or expired, signs in again once and is sent again.
 */
function createApiClient({ baseUrl, wallet, chainId, log, fetch = globalThis.fetch, now = Date.now }: CreateApiClientProps): ApiClient {
  let cookie: string | null = null
  let current: Session | null = null
  // One sign-in at a time: the stream and a pass refused together sign in once.
  let signingIn: Promise<Session> | null = null

  /**
   * A call as the browser makes it: the session's cookie, and on a change the service's own origin, which it checks
   * against its host (`sameOrigin` in lebroker's executor).
   */
  async function call({ method, route, suffix = "", body, signal, accept = JSON_CONTENT_TYPE }: CallProps): Promise<Response> {
    const headers: Record<string, string> = { accept }
    if (cookie !== null) {
      headers.cookie = cookie
    }
    if (method !== HttpMethod.GET) {
      headers.origin = baseUrl.origin
    }
    if (body !== undefined) {
      headers["content-type"] = JSON_CONTENT_TYPE
    }
    const init: RequestInit = {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    }
    return fetch(new URL(`${route}${suffix}`, baseUrl), init).catch((error: unknown) => {
      if (signal?.aborted === true) {
        throw error
      }
      throw new ApiError({ message: ApiErrorText.UNREACHABLE, status: null })
    })
  }

  async function openSession(): Promise<Session> {
    const issued = await readAnswer({ response: await call({ method: HttpMethod.POST, route: ApiRoute.NONCE }), schema: issuedNonce })
    const issuedAt = new Date(now())
    const account = wallet.account()
    const message = createSiweMessage({
      address: account.address,
      chainId: chainId ?? SIGN_IN_DEFAULT_CHAIN_ID,
      domain: baseUrl.host,
      uri: baseUrl.origin,
      version: SIWE_VERSION,
      nonce: issued.nonce,
      statement: SIGN_IN_STATEMENT,
      // Says, in what the wallet signs, that the session is this signer's: lebroker then counts it as connected while its
      // event stream is open, and leaves the requests it signs to it rather than to the browser.
      resources: [MAIN_SIGNER_RESOURCE],
      issuedAt,
      expirationTime: new Date(issuedAt.getTime() + SIGN_IN_TTL_MS),
    })
    const signature = await account.signMessage({ message })
    // A sign-in replaces the session it names: the old cookie goes with it, so a refused one is never kept.
    const response = await call({ method: HttpMethod.POST, route: ApiRoute.SESSION, body: { message, signature } })
    const opened = await readAnswer({ response, schema: sessionBody })
    const pair = sessionCookie({ response })
    if (pair === null) {
      throw new ApiError({ message: ApiErrorText.NO_SESSION_COOKIE, status: response.status })
    }
    if (opened.user === null || opened.user === undefined) {
      throw new ApiError({ message: ApiErrorText.NO_USER, status: response.status })
    }
    const renewed = current !== null
    cookie = pair
    current = { user: opened.user, accountId: opened.accountId ?? null }
    log({ event: LogEvent.SESSION, wallet: wallet.info, fields: { stage: renewed ? SessionStage.RENEWED : SessionStage.SIGNED_IN } })
    return current
  }

  function signIn(): Promise<Session> {
    signingIn ??= openSession().finally(() => {
      signingIn = null
    })
    return signingIn
  }

  /** A call under the session: signed in first when there's none, and again once when the service says it ended. */
  async function authed(props: CallProps): Promise<Response> {
    if (cookie === null) {
      await signIn()
    }
    const sent = cookie
    const response = await call(props)
    if (response.status !== 401) {
      return response
    }
    await response.body?.cancel()
    // Another call may have signed in again meanwhile, or be signing in: its session is the one to use.
    if (cookie === sent) {
      cookie = null
    }
    if (cookie === null) {
      await signIn()
    }
    return call(props)
  }

  return {
    signIn,
    session: () => current,
    signatureRequests: async () =>
      readAnswer({ response: await authed({ method: HttpMethod.GET, route: ApiRoute.SIGNATURE_REQUESTS }), schema: signatureRequestsList }),
    accounts: async () =>
      readAnswer({ response: await authed({ method: HttpMethod.GET, route: ApiRoute.ACCOUNTS }), schema: accountsList }),
    sign: async ({ id, signature }) =>
      readAnswer({
        response: await authed({
          method: HttpMethod.POST,
          route: ApiRoute.SIGNATURE_REQUESTS,
          suffix: `/${encodeURIComponent(id)}/${RequestAction.SIGN}`,
          body: { signature },
        }),
        schema: requestAnswer,
      }),
    decline: async ({ id, reason }) =>
      readAnswer({
        response: await authed({
          method: HttpMethod.POST,
          route: ApiRoute.SIGNATURE_REQUESTS,
          suffix: `/${encodeURIComponent(id)}/${RequestAction.DECLINE}`,
          body: { reason },
        }),
        schema: requestAnswer,
      }),
    events: async ({ signal }) => {
      const response = await authed({ method: HttpMethod.GET, route: ApiRoute.EVENTS, signal, accept: EVENT_STREAM_CONTENT_TYPE })
      if (!response.ok) {
        await response.body?.cancel()
        throw new ApiError({ message: ApiErrorText.FAILED, status: response.status })
      }
      return response
    },
  }
}

export { createApiClient }
