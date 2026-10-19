import { ApiRoute, RequestAction } from "../../api/enums"

const SESSION_COOKIE = "lebroker_session"

const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** `/api/v1/signature-requests/<id>/sign`, as the service matches it. */
const SIGN_ROUTE = new RegExp(`^${ApiRoute.SIGNATURE_REQUESTS}/([A-Za-z0-9-]{1,64})/${RequestAction.SIGN}$`)

const SIGNATURE_REQUESTS_FRAME = 'event: signature-requests\ndata: {"type":"signature-requests"}\n\n'

export { SESSION_COOKIE, SESSION_TTL_MS, SIGN_ROUTE, SIGNATURE_REQUESTS_FRAME }
