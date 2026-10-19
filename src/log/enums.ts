/** What a log line tells: one JSON line each. */
enum LogEvent {
  STARTED = "started",
  STOPPED = "stopped",
  /** A wallet signed in to lebroker, or signed in again after its session ended. */
  SESSION = "session",
  /** The sign-in was refused or failed: retried later. */
  SESSION_FAILED = "session-failed",
  /** The event stream opened or dropped; polling covers the time it's down. */
  STREAM = "stream",
  /** Reading the waiting requests failed: tried again on the next pass. */
  READ_FAILED = "read-failed",
  SIGNED = "signed",
  /** The allowlist refused a request: told once, left for the user to sign or not in the browser. */
  REFUSED = "refused",
  /** Signing or sending a signature failed. */
  FAILED = "failed",
}

enum SessionStage {
  SIGNED_IN = "signed-in",
  RENEWED = "renewed",
}

enum StreamStage {
  CONNECTED = "connected",
  DROPPED = "dropped",
}

export { LogEvent, SessionStage, StreamStage }
