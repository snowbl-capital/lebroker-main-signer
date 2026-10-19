enum SignPayloadError {
  /** The typed data names another chain than the one its allowlist allows: never signed. */
  NOT_ALLOWED_CHAIN = "This request names a chain lebroker never signs on: nothing was signed.",
}

export { SignPayloadError }
