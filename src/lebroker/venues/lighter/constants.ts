/** Lighter's mainnet API, for REST reads. */
const API_URL = "https://mainnet.zklighter.elliot.ai"

/**
 * Lighter's fast-withdrawal pool account, as `fastwithdraw/info` answered for the test account on 8 November 2026:
 * pinned, so that the signer and Main's wallet allow a transfer to it alone, and a read naming another refuses the move.
 */
const FAST_WITHDRAW_POOL_INDEX = 675_395

/** The fast withdrawal's memo: the 20-byte address it pays, then 12 zero bytes, in hex (lighter-python, withdraw_fast). */
const FAST_WITHDRAW_MEMO_PADDING = "00".repeat(12)

export { API_URL, FAST_WITHDRAW_MEMO_PADDING, FAST_WITHDRAW_POOL_INDEX }
