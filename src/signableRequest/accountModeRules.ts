import { shortAddress } from "../lebroker/core/model"
import { HYPERLIQUID_USER_SET_ABSTRACTION_TYPES, HyperliquidAbstraction } from "../lebroker/venues/model"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import { hyperliquidChain } from "./transferRules"
import type { SignSummary, TypedRuleProps } from "./types"
import { expectTypes, isAddress, refuse, text, wholeNumber } from "./utils"

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
  wholeNumber({ value: props.typedData.message.nonce })
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
