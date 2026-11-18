/** Why this signer leaves a LaMarge move's Relay bridge to the browser. */
enum RelayRefusal {
  /** lebroker's browser checks a bridge with the signer Lambda's own Relay checks, which this repository doesn't hold yet. */
  NOT_HERE = "This signer doesn't sign a LaMarge move's Relay bridge yet: sign it in the browser, which checks Relay's order against the move.",
}

export { RelayRefusal }
