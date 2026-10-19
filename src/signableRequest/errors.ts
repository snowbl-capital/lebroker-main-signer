import type { NotSignableProps } from "./types"

/** A request the browser won't sign, in its refusal's words. */
class NotSignable extends Error {
  constructor({ refusal }: NotSignableProps) {
    super(refusal)
  }
}

export { NotSignable }
