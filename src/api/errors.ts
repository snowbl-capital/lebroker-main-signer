import type { ApiErrorProps } from "./types"

/** A call lebroker refused or didn't answer: its words, and its status; null when nothing answered. */
class ApiError extends Error {
  readonly status: number | null

  constructor({ message, status }: ApiErrorProps) {
    super(message)
    this.status = status
  }
}

export { ApiError }
