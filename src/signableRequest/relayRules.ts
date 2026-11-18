// This repository's own, in place of lebroker's `relayRules.ts`: lebroker's browser holds a LaMarge move's Relay bridge
// to the signer Lambda's Relay checks (`@lebroker/signer/relay`), which this repository doesn't copy (README.md, "Kept
// in sync with lebroker"). Until they're shared as a package, every bridge request is declined here, its reason said,
// and the browser signs it: a bridge's signatures last minutes, unlike a take's payment.
import { RelayRefusal } from "../relayDecline/enums"
import type { RelayCallRuleProps, RelayTypedRuleProps, SignSummary } from "./types"
import { refuse } from "./utils"

/** A bridge's nonce mapping or `SendAsset`: declined here. */
function relayTypedRule(_props: RelayTypedRuleProps): SignSummary {
  return refuse({ refusal: RelayRefusal.NOT_HERE })
}

/** A bridge's `approve` or deposit: declined here. */
function relayCallRule(_props: RelayCallRuleProps): SignSummary {
  return refuse({ refusal: RelayRefusal.NOT_HERE })
}

export { relayCallRule, relayTypedRule }
