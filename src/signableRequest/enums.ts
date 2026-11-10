/** Why the browser refuses to sign a request: before the wallet opens, nothing is signed. */
enum SignableRefusal {
  UNKNOWN_KIND = "leneutre never asks Main to sign this kind of request.",
  UNKNOWN_VENUE = "leneutre never asks Main to sign this for this venue.",
  UNKNOWN_SHAPE = "This request isn't one leneutre builds: its signing domain or its fields are not the expected ones.",
  UNKNOWN_CHAIN = "This request names a chain leneutre never signs on.",
  OTHER_MAIN = "This request names another wallet than your Main.",
  OTHER_ACCOUNT = "This request is for another account than the one it names.",
  NOT_YOUR_ACCOUNT = "This request sends funds to an address that isn't one of your accounts.",
  /** Where the signing side reads Main's address book: the Main signer, never the browser. */
  NOT_IN_ADDRESS_BOOK = "This request sends funds to an account your address book doesn't approve: approve it in Settings, Address book, or sign it in your wallet.",
  NOT_LEBROKER_AGENT = "This request approves an agent that isn't leneutre's.",
  NOT_LEBROKER_KEY = "This request registers a key at an index leneutre doesn't use.",
  WITHDRAW_PERMISSION = "This request gives an agent more than trading: leneutre's agent never withdraws.",
  OTHER_PERMISSIONS = "This request gives leneutre's agent other permissions than the ones it uses.",
  TOO_LONG = "This request lasts longer than leneutre ever asks.",
  OPAQUE = "This request can't be read before it's signed, so the browser won't sign it.",
  LAMARGE_CHECK = "LaMarge's checks refused this request",
  NO_TAKE = "This transfer pays someone else, and names no LaMarge take whose maker it pays.",
  NO_TAKER_FEE = "This LaMarge take names no taker fee, which LaMarge's checks require: it was asked before fees.",
  NOT_TAKE_ACCOUNTS = "This Lighter transfer goes between other accounts than Main's and the maker's its LaMarge take names.",
  UNKNOWN_DEPLOYMENT = "This request doesn't say which LaMarge it's for, or names one leneutre doesn't sign for.",
  NOT_MAIN_LIGHTER_ACCOUNT = "This request registers LaMarge's key on another Lighter account than Main's.",
  /** Main's Lighter transfer, whose accounts Lighter names by index only. */
  LIGHTER_ACCOUNTS_UNREAD = "Lighter's accounts this transfer names couldn't be read just now: nothing was signed.",
  NOT_FROM_MAIN_LIGHTER = "This Lighter transfer leaves another account than your Main's.",
  FEE_OVER_CAP = "This transfer pays the venue a larger fee than it ever charges.",
  OTHER_DEPLOYMENT_KEY = "This request registers LaMarge's key at another deployment's index than the one it's for.",
  OTHER_DEPLOYMENT_ESCROW = "This request names another LaMarge escrow than the one of the deployment it's for.",
  NOT_TAKE_RECIPIENT = "This LaMarge take delivers to another address than your Main.",
  /** A take's payment whose deliveries differ from what LaMarge's verified attestation commits to, or one attested as a setup step. */
  NOT_ATTESTED_TAKE = "This LaMarge take delivers otherwise than LaMarge attested it would.",
  NOT_TAKE_DELIVERY = "This LaMarge take delivers another token than its venue's own on its chain, or on more than one chain.",
  TAKE_LOSS = "This LaMarge take brings back less than leneutre ever lets a take lose of what it pays.",
  /** Main's withdrawal straight into a venue's deposit address for Main: only where it opens Main's account. */
  DEPOSIT_VENUE = "This withdrawal pays a venue leneutre never opens Main's account on with a withdrawal.",
  DEPOSIT_TOO_SMALL = "This withdrawal is less than the venue opens an account from once Hyperliquid's fee is out.",
  DEPOSIT_UNREAD = "The venue's deposit address for your Main couldn't be read just now: nothing was signed.",
  NOT_DEPOSIT_ADDRESS = "This withdrawal pays an address that isn't the venue's deposit address for your Main.",
  /** Lighter's fast withdrawal is a transfer to its pool, which leneutre pins. */
  /** Main's Deposit Wallet batch for Polymarket's bridge: one pUSD transfer, to the address the browser asked the bridge for. */
  NOT_BRIDGE_ADDRESS = "This batch pays another address than the one Polymarket's bridge gave your browser for your Bybit deposit address.",
  NOT_DEPOSIT_WALLET = "This batch is for another wallet than your Main's own Polymarket Deposit Wallet.",
  NOT_FAST_WITHDRAW_POOL = "This Lighter withdrawal goes to another account than Lighter's fast-withdrawal pool leneutre signs for.",
  /** A LaMarge send on Polymarket, whose wallet prompt shows a hash, without the operation it hashes. */
  NO_SEND_OP = "This Polymarket send doesn't carry the operation its signature hashes, so the browser can't check it.",
  NO_DELETED_PROXY = "This Polymarket proxy deletion doesn't name the proxy its signature hashes, so the browser can't check it.",
  OTHER_DELETION = "This Polymarket proxy deletion signs another operation than the deletion of the proxy it names.",
  /** Main's Hyperliquid account switched to a mode (D66): only ever to unified. */
  NOT_UNIFIED = "This request switches Main's Hyperliquid account to another mode than unified.",
}

/** The words of a request's decoded summary, shown before Sign. */
enum SignSummaryText {
  APPROVE_HYPERLIQUID_AGENT = "Approve leneutre's Hyperliquid agent to trade for Main",
  APPROVE_ASTER_AGENT = "Approve leneutre's Aster agent to trade perps for Main, never to withdraw",
  APPROVE_ASTER_CONVERT_AGENT = "Let leneutre convert USDC to USDT on Aster's Spot market for Main: no perps trading, no withdrawal",
  APPROVE_POLYMARKET_PROXY = "Approve leneutre's Polymarket Perps proxy to trade for Main",
  DELETE_POLYMARKET_PROXY = "Delete one of Main's older Polymarket Perps proxies: Polymarket counts it toward its limit even once expired, so each older one goes before the new one is approved",
  PROVE_LIGHTER_ACCOUNT = "Prove that this Lighter account is Main's",
  REGISTER_LIGHTER_KEY = "Register leneutre's trading key on Main's Lighter account",
  TRANSFER = "Transfer funds from Main to one of your accounts",
  WITHDRAW_TO_MAIN = "Withdraw funds to Main's own wallet",
  WITHDRAW_INTO_LIGHTER = "Withdraw funds from Main's Hyperliquid straight into Main's own Lighter account, which opens it",
  UNIFY_HYPERLIQUID = "Switch Main's Hyperliquid account to unified mode: one balance per asset backs all of its positions",
  WITHDRAW_INTO_BYBIT = "Withdraw funds from Main's Hyperliquid straight into Main's own Bybit account, by its deposit address",
  LIGHTER_FAST_INTO_BYBIT = "Withdraw funds from Main's Lighter straight into Main's own Bybit account by a fast withdrawal, to its deposit address",
  POLYMARKET_PERPS_TO_WALLET = "Withdraw Main's Polymarket Perps margin to Main's own Polymarket Deposit Wallet, which Polymarket's bridge then pays into Main's Bybit account from",
  POLYMARKET_BRIDGE_INTO_BYBIT = "Withdraw funds from Main's Polymarket Deposit Wallet straight into Main's own Bybit account through Polymarket's bridge",
  CCTP_INTO_BYBIT = "Send funds from Main's Hyperliquid straight into Main's own Bybit account through Circle's CCTP, by its deposit address",
  LAMARGE_PERMIT = "Let LaMarge's escrow take this token from Main when Main signs a move",
  LAMARGE_PAYMENT = "Pay a LaMarge move into its escrow",
  LAMARGE_REFUND = "Take back a LaMarge payment",
  LAMARGE_ASTER_TAKE = "Pay a LaMarge take inside Aster: the maker who fills it, from Main's Aster account",
  LAMARGE_LIGHTER_TAKE = "Pay a LaMarge take inside Lighter: the maker who fills it, from Main's Lighter account",
  LAMARGE_ASTER_AGENT = "Approve LaMarge's Aster agent to move Main's margin to Spot, never to withdraw",
  LAMARGE_LIGHTER_KEY = "Register LaMarge's key on Main's Lighter account",
  LAMARGE_SIGN_IN = "Sign in to LaMarge with Main",
  LAMARGE_SEND = "Send funds from Main to one of your sub-accounts on the same venue, through LaMarge",
  /** "Step 2 of 8: <action>", for one of a chain of signatures. */
  STEP = "Step",
  STEP_OF = "of",
}

enum SignSummaryLabel {
  AGENT = "Agent",
  PROXY = "Proxy",
  VALID_UNTIL = "Valid until",
  CHAIN = "Signed on chain",
  /** The venue account a request changes, as its short address. */
  ACCOUNT = "Account",
  ACCOUNT_INDEX = "Lighter account",
  KEY_INDEX = "Key index",
  AMOUNT = "Amount",
  TO = "To",
  TOKEN = "Token",
  SPENDER = "Spender",
  PAYMENTS = "Payments",
  MAKER = "Maker's Aster account",
  MAKER_LIGHTER = "Maker's Lighter account",
  LIGHTER_FEE = "Lighter's fee",
  LIGHTER_POOL = "Lighter's fast-withdrawal pool",
  BRIDGE_ADDRESS = "Polymarket's bridge address, read from the bridge",
  STARTED_BY = "Started by",
  /** The venue's deposit address for Main, as the signing side read it from the venue itself. */
  DEPOSIT_ADDRESS = "Deposit address, read from the venue",
  /** The chain a send out of a venue pays on, by its EVM id. */
  DESTINATION_CHAIN = "Paid on chain",
}

/** Who started the move a request signs for, as the request says it. */
enum SignStarter {
  USER = "You",
  MARGIN_KEEPER = "The margin keeper",
}

/** LaMarge's own words, as its SDK and its API write them. */
enum LaMargeWord {
  PERMIT = "permit",
  /** What a verified attestation proves of a take (`Attested`), as LaMarge's SDK names it. */
  ATTESTED_TAKE = "take",
  ASTER = "aster",
  ASTER_TRANSFER = "aster_transfer",
  LIGHTER = "lighter",
  LIGHTER_TRANSFER = "lighter_transfer",
  PERMIT_TYPE = "Permit",
  PAY_TAKE_TYPE = "PayTake",
  REFUND_TYPE = "RefundPayment",
  SEND_ASSET_TYPE = "HyperliquidTransaction:SendAsset",
  ACTION_TYPE = "Action",
  WITHDRAW_TYPE = "Withdraw",
  MESSAGE_TYPE = "Message",
  SIGN_IN_LINE = " wants you to sign in with your Ethereum account:",
  NONCE_PREFIX = "Nonce: ",
  EXPIRES_PREFIX = "Expiration Time: ",
}

export { LaMargeWord, SignStarter, SignSummaryLabel, SignSummaryText, SignableRefusal }
