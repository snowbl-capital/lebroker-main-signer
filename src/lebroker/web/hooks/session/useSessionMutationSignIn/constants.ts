/** What the wallet shows above the sign-in message. */
const SIGN_IN_STATEMENT = "Sign in to lebroker. This costs nothing and sends no transaction."

/** The signed message is only good for a short while, like the executor's nonce. */
const SIGN_IN_TTL_MS = 5 * 60 * 1000

export { SIGN_IN_STATEMENT, SIGN_IN_TTL_MS }
