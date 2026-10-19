/** What the wallet that signs in is (D31): a contract wallet's Main delegates nothing on the venues. */
enum WalletKind {
  EOA = "eoa",
  CONTRACT = "contract",
}

enum AccountKind {
  /** The signed-in wallet itself: we never hold its key. */
  MAIN = "main",
  /** A key the signer generated and holds (D3). */
  SUB = "sub",
}

enum AccountState {
  /** Its slot reserved, its key not made yet by the signer. */
  CREATING = "creating",
  OPEN = "open",
  /** Emptied and closed by its user (D18): its slot is free again, its key's deletion scheduled. */
  CLOSED = "closed",
}

/** A user's access, as their row says it. */
enum UserAccess {
  /** Signed in, not admitted yet: sent to `/access` from every page but the public ones. */
  PENDING = "pending",
  ADMITTED = "admitted",
  /** Admitted, then suspended by an operator (D30): lebroker changes nothing for them until it is lifted. */
  SUSPENDED = "suspended",
}

/** What Main is asked to sign (D37). */
enum SignatureRequestKind {
  /** A venue's delegated access, given the first time (D38). */
  VENUE_SETUP = "venue-setup",
  /** A venue's delegated access, given again before it ends (D2). */
  VENUE_RENEWAL = "venue-renewal",
  /** A LaMarge move out of one of Main's venues, which its delegated key can't sign. */
  LAMARGE_MOVE = "lamarge-move",
  /** A transfer from Main to another account inside a venue (D19). */
  TRANSFER = "transfer",
  WITHDRAWAL = "withdrawal",
}

/** Why it's asked (D37). */
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

export {
  AccountKind,
  AccountState,
  SignaturePayloadKind,
  SignatureRequestKind,
  SignatureRequestReason,
  SignatureRequestState,
  UserAccess,
  WalletKind,
}
