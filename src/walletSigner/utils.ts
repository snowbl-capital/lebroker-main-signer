import type { ErrorTextProps, Timers } from "./types"

/** An error's words for a log line: its message, never the object, which may carry what it was called with. */
function errorText({ error }: ErrorTextProps): string {
  return error instanceof Error ? error.message : String(error)
}

const runtimeTimers: Timers = {
  every: ({ ms, run }) => {
    const interval = setInterval(run, ms)
    return () => clearInterval(interval)
  },
  sleep: ({ ms, signal }) =>
    new Promise(resolve => {
      if (signal.aborted) {
        resolve()
        return
      }
      const timeout = setTimeout(done, ms)
      function done() {
        clearTimeout(timeout)
        signal.removeEventListener("abort", done)
        resolve()
      }
      signal.addEventListener("abort", done)
    }),
}

export { errorText, runtimeTimers }
