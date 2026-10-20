import { TAKER_API_KEY } from "@lamarge/sdk/protocol"

/**
 * The first API key index lebroker's own key may take on each account's Lighter account (D6): one key per account.
 * Lighter's own apps take indexes 0 to 3, and LaMarge's key 254 (`TAKER_API_KEY`); other tools tend to take the low
 * ones after them, and a self-hosted executor 200. A registration replaces whatever key stands at its index, so
 * lebroker registers its own at the first index from 200 to 253 where none stands, or where its own does: a key it
 * didn't make is never replaced (`chooseLighterKeyIndex`), and LaMarge's index is never taken.
 */
const LIGHTER_KEY_INDEX = 200

/** The last API key index lebroker's key may take, 253: the one below LaMarge's key, which lebroker never takes. */
const LIGHTER_LAST_KEY_INDEX = TAKER_API_KEY - 1

/**
 * The resource a Main signer's sign-in message names: the session it opens is the signer's (`SessionClient`), and the
 * service knows the signer is connected while that session's event stream is open. Signed by the wallet with the rest
 * of the message, it can't be added to a browser's session afterwards.
 */
const MAIN_SIGNER_RESOURCE = "urn:lebroker:main-signer"

export { LIGHTER_KEY_INDEX, LIGHTER_LAST_KEY_INDEX, MAIN_SIGNER_RESOURCE }
