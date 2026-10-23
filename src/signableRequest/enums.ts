/** Why the browser refuses to sign a request: before the wallet opens, nothing is signed (D2). */
enum SignableRefusal {
  UNKNOWN_KIND = "lebroker never asks Main to sign this kind of request.",
  UNKNOWN_VENUE = "lebroker never asks Main to sign this for this venue.",
  UNKNOWN_SHAPE = "This request isn't one lebroker builds: its signing domain or its fields are not the expected ones.",
  UNKNOWN_CHAIN = "This request names a chain lebroker never signs on.",
  OTHER_MAIN = "This request names another wallet than your Main.",
  OTHER_ACCOUNT = "This request is for another account than the one it names.",
  NOT_YOUR_ACCOUNT = "This request sends funds to an address that isn't one of your accounts.",
  NOT_LEBROKER_AGENT = "This request approves an agent that isn't lebroker's.",
  NOT_LEBROKER_KEY = "This request registers a key at an index lebroker doesn't use.",
  WITHDRAW_PERMISSION = "This request gives an agent more than trading: lebroker's agent never withdraws.",
  TOO_LONG = "This request lasts longer than lebroker ever asks.",
  OPAQUE = "This request can't be read before it's signed, so the browser won't sign it.",
  LAMARGE_CHECK = "LaMarge's checks refused this request:",
  NO_TAKE = "This transfer pays someone else, and names no LaMarge take whose maker it pays.",
  NOT_TAKE_ACCOUNTS = "This Lighter transfer goes between other accounts than Main's and the maker's its LaMarge take names.",
  UNKNOWN_DEPLOYMENT = "This request doesn't say which LaMarge it's for, or names one lebroker doesn't sign for.",
  NOT_MAIN_LIGHTER_ACCOUNT = "This request registers LaMarge's key on another Lighter account than Main's.",
  OTHER_DEPLOYMENT_KEY = "This request registers LaMarge's key at another deployment's index than the one it's for.",
  OTHER_DEPLOYMENT_ESCROW = "This request names another LaMarge escrow than the one of the deployment it's for.",
  NO_GAS_RESERVE = "lebroker has no gas reserve pinned for this deployment: Main buys no gas here.",
  NOT_GAS_RESERVE = "This payment goes to an address that isn't lebroker's gas reserve for this deployment.",
  GAS_OVER_CAP = "This payment is more than lebroker's gas reserve is ever paid at once.",
  /** Main's withdrawal straight into a venue's deposit address for Main (D49): only where it opens Main's account. */
  DEPOSIT_VENUE = "This withdrawal pays a venue lebroker never opens Main's account on with a withdrawal.",
  DEPOSIT_TOO_SMALL = "This withdrawal is less than the venue opens an account from once Hyperliquid's fee is out.",
  DEPOSIT_UNREAD = "The venue's deposit address for your Main couldn't be read just now: nothing was signed.",
  NOT_DEPOSIT_ADDRESS = "This withdrawal pays an address that isn't the venue's deposit address for your Main.",
}

/** The words of a request's decoded summary, shown before Sign. */
enum SignSummaryText {
  APPROVE_HYPERLIQUID_AGENT = "Approve lebroker's Hyperliquid agent to trade for Main",
  APPROVE_ASTER_AGENT = "Approve lebroker's Aster agent to trade perps for Main, never to withdraw",
  APPROVE_POLYMARKET_PROXY = "Approve lebroker's Polymarket Perps proxy to trade for Main",
  PROVE_LIGHTER_ACCOUNT = "Prove that this Lighter account is Main's",
  REGISTER_LIGHTER_KEY = "Register lebroker's trading key on Main's Lighter account",
  TRANSFER = "Transfer funds from Main to one of your accounts",
  WITHDRAW_TO_MAIN = "Withdraw funds to Main's own wallet",
  WITHDRAW_INTO_LIGHTER = "Withdraw funds from Main's Hyperliquid straight into Main's own Lighter account, which opens it",
  LAMARGE_PERMIT = "Let LaMarge's escrow take this token from Main when Main signs a move",
  LAMARGE_PAYMENT = "Pay a LaMarge move into its escrow",
  LAMARGE_REFUND = "Take back a LaMarge payment",
  LAMARGE_ASTER_TAKE = "Pay a LaMarge take inside Aster: the maker who fills it, from Main's Aster account",
  LAMARGE_LIGHTER_TAKE = "Pay a LaMarge take inside Lighter: the maker who fills it, from Main's Lighter account",
  LAMARGE_ASTER_AGENT = "Approve LaMarge's Aster agent to move Main's margin to Spot, never to withdraw",
  LAMARGE_LIGHTER_KEY = "Register LaMarge's key on Main's Lighter account",
  LAMARGE_SIGN_IN = "Sign in to LaMarge with Main",
  /** Followed by the amount, then what it buys: "Pay lebroker's gas reserve $0.15 for gas on Arbitrum". */
  PAY_GAS_RESERVE = "Pay lebroker's gas reserve",
  FOR_GAS_ON = "for gas on",
  /** lebroker's gas reserve as a payment's destination, followed by its short address. */
  GAS_RESERVE = "lebroker's gas reserve",
}

enum SignSummaryLabel {
  AGENT = "Agent",
  PROXY = "Proxy",
  VALID_UNTIL = "Valid until",
  CHAIN = "Signed on chain",
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
  STARTED_BY = "Started by",
  /** The chain the gas a payment buys is sent on, to Main's wallet. */
  GAS_ON = "Gas on",
  /** The venue's deposit address for Main, as the signing side read it from the venue itself. */
  DEPOSIT_ADDRESS = "Deposit address, read from the venue",
}

/** Who started the move a request signs for, as the request says it. */
enum SignStarter {
  USER = "You",
  MARGIN_KEEPER = "The margin keeper",
}

/** LaMarge's own words, as its SDK and its API write them. */
enum LaMargeWord {
  PERMIT = "permit",
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
