/** What the wallet that signs in is: a contract wallet's Main delegates nothing on the venues. */
enum WalletKind {
  EOA = "eoa",
  CONTRACT = "contract",
}

enum AccountKind {
  /** The signed-in wallet itself: we never hold its key. */
  MAIN = "main",
  /** A key the signer generated and holds. */
  SUB = "sub",
}

enum AccountState {
  /** Its slot reserved, its key not made yet by the signer. */
  CREATING = "creating",
  OPEN = "open",
  /** Emptied and closed by its user: its slot is free again, its key's deletion scheduled. */
  CLOSED = "closed",
}

/** A user's access, as their row says it. */
enum UserAccess {
  /** Signed in, not admitted yet: sent to `/access` from every page but the public ones. */
  PENDING = "pending",
  ADMITTED = "admitted",
  /** Admitted, then suspended by an operator: lebroker changes nothing for them until it is lifted. */
  SUSPENDED = "suspended",
}

/** What Main is asked to sign. */
enum SignatureRequestKind {
  /** A venue's delegated access, given the first time. */
  VENUE_SETUP = "venue-setup",
  /** A venue's delegated access, given again before it ends. */
  VENUE_RENEWAL = "venue-renewal",
  /** A LaMarge move out of one of Main's venues, which its delegated key can't sign. */
  LAMARGE_MOVE = "lamarge-move",
  /** A transfer from Main to another account inside a venue. */
  TRANSFER = "transfer",
  WITHDRAWAL = "withdrawal",
  /** Main's own venue account switched to the mode lebroker runs it in: Hyperliquid's unified account (D66). */
  ACCOUNT_MODE = "account-mode",
}

/** Why it's asked. */
enum SignatureRequestReason {
  /** The user set a venue up. */
  SETUP = "setup",
  /** An access ends soon. */
  RENEWAL = "renewal",
  /** The margin keeper moves margin out of a venue of Main. */
  MARGIN_KEEPER = "margin-keeper",
  /** A move the user asked for. */
  MOVE = "move",
}

/** Where a request stands: waiting and deferred ones are open, the others settled and out of the banner. */
enum SignatureRequestState {
  WAITING = "waiting",
  /** Put off with Later: back in the banner once its time is up. */
  DEFERRED = "deferred",
  SIGNED = "signed",
  EXPIRED = "expired",
  /** What it was for no longer needs it: a newer request replaced it, or its account closed. */
  CANCELLED = "cancelled",
  /** Signed, then refused by its venue: `outcome` says why. */
  FAILED = "failed",
}

/** How the browser wallet signs a request's payload. */
enum SignaturePayloadKind {
  /** `eth_signTypedData_v4`. */
  TYPED_DATA = "typed-data",
  /** `personal_sign`. */
  PERSONAL_MESSAGE = "personal-message",
}

/**
 * What a grantee may do on a sub-account shared with them, feature by feature: the fields Main's
 * `SubAccountAccess` approval names, in its order.
 */
enum GrantFeature {
  /** The bots and their features. */
  STRATEGIES = "strategies",
  /** Grants nothing since executor features went: it stays a field of the approval Main signs. */
  EXECUTOR_RULES = "executorRules",
  MARGIN_KEEPER = "marginKeeper",
  /** Margin moved between the account's own venues, through LaMarge. */
  MARGIN_MOVES = "marginMoves",
  /** The venues' setup and settings. */
  VENUES = "venues",
  NOTIFICATIONS = "notifications",
  /** Moves of funds from the sub-account to its Main, and no other: a grantee never moves funds anywhere else. */
  MOVE_FUNDS_TO_MAIN = "moveFundsToMain",
}

/** How far a grantee goes in a feature: seeing it, or changing it too. */
enum GrantAccess {
  READ = "read",
  WRITE = "write",
}

export {
  AccountKind,
  AccountState,
  GrantAccess,
  GrantFeature,
  SignaturePayloadKind,
  SignatureRequestKind,
  SignatureRequestReason,
  SignatureRequestState,
  UserAccess,
  WalletKind,
}
