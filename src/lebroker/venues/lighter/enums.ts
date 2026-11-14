/** The REST paths read, on Lighter's mainnet host. */
enum LighterEndpoint {
  /** Every market's details: perps in `order_book_details`, spot apart; `filter=perp` keeps the perps alone. */
  ORDER_BOOK_DETAILS = "/api/v1/orderBookDetails",
  /** A market's settled funding, newest last, at most 750 a call. */
  FUNDINGS = "/api/v1/fundings",
  /** A market's resting orders, one by one: up to 250 a side. */
  ORDER_BOOK_ORDERS = "/api/v1/orderBookOrders",
  /** Accounts, public: those of an L1 address, or the one at an index, with their balances and positions. */
  ACCOUNT = "/api/v1/account",
  /** The next nonce of an account's API key, read once before its first transaction; counted locally after. */
  NEXT_NONCE = "/api/v1/nextNonce",
  /** The public keys registered on an account, at each API key index. */
  API_KEYS = "/api/v1/apikeys",
  /** Sends one signed transaction, as a form of its `tx_type` and `tx_info`. It acknowledges; it doesn't fill. */
  SEND_TX = "/api/v1/sendTx",
  /** The account's orders in the book, with an auth token. */
  ACTIVE_ORDERS = "/api/v1/accountActiveOrders",
  /** The account's orders done, newest first, at most 100 a page, with an auth token. */
  INACTIVE_ORDERS = "/api/v1/accountInactiveOrders",
  /** Trades, newest first, at most 100 a page; an account's own with an auth token. */
  TRADES = "/api/v1/trades",
  /** The fundings settled on an account's positions, at most 100 a page, with an auth token. */
  POSITION_FUNDING = "/api/v1/positionFunding",
  /** One transaction, public, by its hash (`by=hash`): whether the sequencer executed it or failed it. */
  TX = "/api/v1/tx",
  /** An account's fee on one transfer out now, public, in micro-USDC: 1 USDC from a Standard account, 0 from Premium. */
  TRANSFER_FEE_INFO = "/api/v1/transferFeeInfo",
  /** An account's tier and fee ticks, with an auth token: the one read that says whether it is Standard or Premium. */
  ACCOUNT_LIMITS = "/api/v1/accountLimits",
  /** Moves the account to another tier, with an auth token: Premium before a sub-account's first transfer out. */
  CHANGE_ACCOUNT_TIER = "/api/v1/changeAccountTier",
  /** The fast-withdrawal pool an account's fast withdrawal goes to, and its limits, with an auth token. */
  FAST_WITHDRAW_INFO = "/api/v1/fastwithdraw/info",
  /** Sends a signed transfer to the pool as a fast withdrawal, as a form of its `tx_info` and `to_address`, with an auth token. */
  FAST_WITHDRAW = "/api/v1/fastwithdraw",
  /**
   * Refers the account by a referral code, with an auth token (lighter-python `ReferralApi.referral_use`): its form names
   * the account's L1 address and the code, with what Lighter's own site sends beside them.
   */
  REFERRAL_USE = "/api/v1/referral/use",
  /** A referrer's referees, a page at a time, with each one's trades and fees since it was referred, and their totals. */
  REFERRAL_USER_REFERRALS = "/api/v1/referral/userReferrals",
  /**
   * A referrer's referees' trades and fees summed week by week, with an auth token: its eligible referees' with
   * `is_eligible`, as Lighter's referral page sums the kickbacks.
   */
  REFERRAL_STATS = "/api/v1/referral/stats",
  /** An L1 address's own settings, with an auth token: as a referrer's, its kickback rate now and each one it had before. */
  L1_METADATA = "/api/v1/l1Metadata",
  /** An account's transfers in and out, newest first, 100 a page; a private account's with an auth token of its own. */
  TRANSFER_HISTORY = "/api/v1/transfer/history",
}

/** How `/api/v1/account?by=` finds accounts: those of an L1 address, or the one at an index. */
enum LighterLookup {
  L1_ADDRESS = "l1_address",
  INDEX = "index",
}

export { LighterEndpoint, LighterLookup }
