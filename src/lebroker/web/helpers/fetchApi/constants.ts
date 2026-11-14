import { AsyncLocalStorage } from "node:async_hooks"
import type { ApiScope } from "./types"

/**
 * The session a mirrored helper's `fetchApi` reads under: the signing wallet's, set around its reads
 * (`withApiScope`), so each wallet's helpers read under its own session, never another's.
 */
const API_SCOPE = new AsyncLocalStorage<ApiScope>()

/** Where the web reads its API with its own default settings (`DEFAULT_RUNTIME.apiUrl`): relative to its page. */
const DEFAULT_API_URL = "/api"

export { API_SCOPE, DEFAULT_API_URL }
