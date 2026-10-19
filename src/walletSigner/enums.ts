/** Which step of a request failed, as its log line says. */
enum FailedStep {
  SIGN = "sign",
  SEND = "send",
}

/** What a failed read was reading, as its log line says. */
enum ReadSubject {
  SIGN_IN = "sign-in",
  REQUESTS = "signature-requests",
  ACCOUNTS = "accounts",
  EVENTS = "events",
}

export { FailedStep, ReadSubject }
