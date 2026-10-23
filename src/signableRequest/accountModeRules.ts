import { shortAddress } from "../lebroker/core/model"
import { HYPERLIQUID_USER_SET_ABSTRACTION_TYPES, HyperliquidAbstraction } from "../lebroker/venues/model"
import { CLOCK_SLACK_MS } from "./constants"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import { hyperliquidChain } from "./transferRules"
import type { SignSummary, TypedRuleProps } from "./types"
import { atMost, expectTypes, isAddress, refuse, text, wholeNumber } from "./utils"

/**
 * Hyperliquid: Main's own account switched to unified mode (D66), `userSetAbstraction` on mainnet, on the chain its
 * wallet shows or one lebroker signs on. For Main's own address only, never one of its Hyperliquid sub-accounts, and to
 * `unifiedAccount` only: never portfolio margin, nor standard again.
 */
function hyperliquidUnifiedAccount(props: TypedRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({
    typedData: props.typedData,
    types: HYPERLIQUID_USER_SET_ABSTRACTION_TYPES,
    primaryType: "HyperliquidTransaction:UserSetAbstraction",
  })
  if (!isAddress({ address: props.typedData.message.user, other: props.user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (text({ value: props.typedData.message.abstraction }) !== HyperliquidAbstraction.UNIFIED_ACCOUNT) {
    refuse({ refusal: SignableRefusal.NOT_UNIFIED })
  }
  // Hyperliquid's nonce is the time lebroker asked it, in milliseconds: one further ahead would keep the signature
  // usable for longer than lebroker ever asks. Hyperliquid refuses one it has seen, or one too old.
  atMost({ value: wholeNumber({ value: props.typedData.message.nonce }), max: props.askedAt + CLOCK_SLACK_MS })
  return {
    action: SignSummaryText.UNIFY_HYPERLIQUID,
    lines: [
      { label: SignSummaryLabel.ACCOUNT, value: shortAddress({ address: props.user.address }) },
      { label: SignSummaryLabel.CHAIN, value: String(chainId) },
    ],
    chainId,
  }
}

export { hyperliquidUnifiedAccount }
