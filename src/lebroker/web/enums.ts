enum ApiPath {
  OPPORTUNITIES = "/v1/opportunities",
  /** A pair's funding spread over time: its averages, its worst day this week and its hourly series. */
  OPPORTUNITY_HISTORY = "/v1/opportunities/history",
  /** Markets' last 24 hours, 7 or 30 days in steps: the pair's 30-day chart, for its legs' markets. */
  SERIES = "/v1/opportunities/series",
  VENUES = "/v1/venues",
  ASSET_LOGOS = "/v1/asset-logos",
  /** The matching: every market with its symbol. */
  MARKETS = "/v1/markets",
  /** The service's own routes, under the same /api as the market data it passes on. */
  SESSION = "/v1/session",
  SESSION_NONCE = "/v1/session/nonce",
  /** An operator's read-only view of a user's accounts: opened by the operator's own signature, and left. */
  VIEW = "/v1/view",
  /** The executor's clock, what Main's approvals are dated by. */
  TIME = "/v1/time",
  /** The signed-in user's access, and the code that admits them. */
  ACCESS = "/v1/access",
  /** The user's accounts: listed, created from Main's proof; `/switch` and `/close` after it. */
  ACCOUNTS = "/v1/accounts",
  ACCOUNTS_CLOSE = "/v1/accounts/close",
  ACCOUNTS_KEEP = "/v1/accounts/keep",
  ACCOUNTS_RENAME = "/v1/accounts/rename",
  ACCOUNT = "/v1/account",
  EXECUTOR = "/v1/executor",
  PLATFORM_STATS = "/v1/platform-stats",
  STATUS = "/v1/status",
  EVENTS = "/v1/events",
  /** The public API's market stream: which markets' carry moved, as the API reads its figures every second. */
  MARKET_EVENTS = "/v1/markets/events",
  STRATEGIES = "/v1/strategies",
  ORDER_MINIMUM = "/v1/order-minimum",
  CHANNELS = "/v1/channels",
  TELEGRAM_CHAT = "/v1/channels/telegram/chat",
  MARGIN_KEEPER = "/v1/margin-keeper",
  MARGIN_KEEPER_SUMMARY = "/v1/margin-keeper/summary",
  MARGIN_KEEPER_RESUME = "/v1/margin-keeper/resume",
  /** The session's wallet's margin moves by hand between its venue accounts; `/quote` after it says what one would get. */
  MARGIN_MOVES = "/v1/margin-moves",
  /** The session's wallet's venue setups for margin moves through LaMarge; a venue's id after it runs one. */
  LAMARGE_SETUPS = "/v1/lamarge/setups",
  /** The session's wallet's accounts on the venues it trades: whether each is ready, and its own switches. */
  VENUE_ACCOUNTS = "/v1/venue-accounts",
  SETTINGS = "/v1/settings",
  /** Every account's figures at a glance, read-only: the Dashboard matches them to the user's accounts. */
  ORGANIZATION = "/v1/organization",
  /** What waits for Main's signature: the open requests; `/<id>/sign` and `/<id>/defer` after it. */
  SIGNATURE_REQUESTS = "/v1/signature-requests",
  /** What the bell shows: what runs now and what happened, with the user's read mark; `/read` after it moves the mark. */
  INBOX = "/v1/inbox",
  INBOX_READ = "/v1/inbox/read",
  /** The active account's access on each venue; `/<venue>/setup` and `/<venue>/renew` after it. */
  DELEGATIONS = "/v1/delegations",
  /** Whom the user shares their sub-accounts with: listed, granted or changed here, on Main's approval. */
  GRANTS = "/v1/grants",
  GRANTS_REVOKE = "/v1/grants/revoke",
  /** The recipients Main approved in its wallet for its Main signer's transfers: listed, and an entry added. */
  ADDRESS_BOOK = "/v1/address-book",
  /** Main's referral on its venues whose code only its own key binds: its answers read, and one reported. */
  OWNER_REFERRALS = "/v1/owner-referrals",
  /**
   * Main's Bybit key, made by the signer on Main's proof: read, made (`POST`), `/verify` once its API key ID is pasted,
   * and `/deposit-address`, Main's signature of its USDC deposit address on Bybit, read and signed (`POST`).
   */
  BYBIT_KEY = "/v1/bybit-key",
  BYBIT_KEY_VERIFY = "/v1/bybit-key/verify",
  BYBIT_DEPOSIT_ADDRESS = "/v1/bybit-key/deposit-address",
  /** Main's approval of lebroker's builder on its venues where only its own key approves it: read, and answered. */
  OWNER_BUILDERS = "/v1/owner-builders",
  /** Moves of funds between the user's accounts and venues: confirmed here, `/<id>` followed. */
  MOVES = "/v1/fund-moves",
  /** A move's routes before it starts, best first: their steps, who signs each, their cost and time. */
  MOVES_PLAN = "/v1/fund-moves/plan",
  /**
   * `?accountId=…&venue=…`: the gas a deposit from a sub-account's own address into a venue needs there, and whether it's
   * held already.
   */
  MOVES_DEPOSIT_GAS = "/v1/fund-moves/deposit-gas",
  /** `?accountId=…&venue=…`: what a move can take of one of the user's ends now, read whole, for the dialog's Max. */
  MOVES_SOURCE = "/v1/fund-moves/source",
  /**
   * `?accountId=…&venue=…`: Main's way into one of its venues that opens an account on a first deposit only:
   * whether it opened, and what Main's wallet holds where that deposit leaves from.
   */
  MOVES_VENUE_OPENING = "/v1/fund-moves/venue-opening",
  /** The RPC of Aster's signing network, which Main's wallet calls itself as it adds that network. */
  ASTER_SIGNING_RPC = "/v1/aster-signing-rpc",
  /** The RPC proxy the page reads the chains through, `/<chainId>` after it: the executor holds the RPC's key. */
  RPC_PROXY = "/v1/rpc",
}

export { ApiPath }
