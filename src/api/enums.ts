/** The account process's routes the signer calls, as lebroker's executor serves them (`apps/executor/src/app/enums.ts`). */
enum ApiRoute {
  NONCE = "/api/v1/session/nonce",
  SESSION = "/api/v1/session",
  ACCOUNTS = "/api/v1/accounts",
  EVENTS = "/api/v1/events",
  SIGNATURE_REQUESTS = "/api/v1/signature-requests",
  /** The recipients Main approved in its wallet (D70): the service's word, each entry checked again before it's used. */
  ADDRESS_BOOK = "/api/v1/address-book",
}

/** A signature request's action route: `/api/v1/signature-requests/<id>/<action>`. */
enum RequestAction {
  SIGN = "sign",
  /** The signer won't sign the request, and says why: the user's pages offer it in the browser. */
  DECLINE = "decline",
}

enum HttpMethod {
  GET = "GET",
  POST = "POST",
}

enum ApiErrorText {
  UNREACHABLE = "lebroker didn't answer",
  FAILED = "lebroker refused the call",
  UNEXPECTED = "lebroker answered something this signer doesn't read",
  /** A sign-in answered without the session's cookie. */
  NO_SESSION_COOKIE = "lebroker opened no session",
  /** The session belongs to no user: an executor without hosted users. */
  NO_USER = "lebroker's session names no user: this signer works with the hosted service only",
  /** A session naming another address than the wallet that signed in: nothing is signed on it. */
  OTHER_USER = "lebroker's session names another address than this wallet: nothing will be signed on it",
}

export { ApiErrorText, ApiRoute, HttpMethod, RequestAction }
