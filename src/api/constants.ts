/**
 * The session cookie's names, as lebroker's executor sets them: the plain one over http on loopback, the `__Host-` one
 * over https (`apps/executor/src/app/constants.ts`).
 */
const SESSION_COOKIES: readonly string[] = ["lebroker_session", "__Host-lebroker_session"]

/** The chain a sign-in message names when MAIN_CHAIN_ID names none: Ethereum's. An EOA's sign-in reads no chain. */
const SIGN_IN_DEFAULT_CHAIN_ID = 1

const SIWE_VERSION = "1"

const JSON_CONTENT_TYPE = "application/json"

const EVENT_STREAM_CONTENT_TYPE = "text/event-stream"

/** What the executor serves its deployment.js as. */
const DEPLOYMENT_CONTENT_TYPE = "text/javascript"

export { DEPLOYMENT_CONTENT_TYPE, EVENT_STREAM_CONTENT_TYPE, JSON_CONTENT_TYPE, SESSION_COOKIES, SIGN_IN_DEFAULT_CHAIN_ID, SIWE_VERSION }
