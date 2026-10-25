/** Which step failed, as its log line says: a request's, or keeping the address book's record. */
enum FailedStep {
  SIGN = "sign",
  SEND = "send",
  /** Telling lebroker the allowlist refused the request. */
  DECLINE = "decline",
  /** Writing the address-book entries this signer checked to their file (lebroker's D70). */
  RECORD = "record",
}

/** What a failed read was reading, as its log line says. */
enum ReadSubject {
  SIGN_IN = "sign-in",
  REQUESTS = "signature-requests",
  ACCOUNTS = "accounts",
  ADDRESS_BOOK = "address-book",
  EVENTS = "events",
}

/** Why this signer refuses a request before its allowlist runs. */
enum SignerRefusal {
  /** Only the user approves a recipient, in their wallet (lebroker's D70): never this signer, whatever the request says. */
  ADDRESS_BOOK_ENTRY = "This request asks Main to sign an address book entry: only you approve a recipient, in your wallet.",
}

export { FailedStep, ReadSubject, SignerRefusal }
