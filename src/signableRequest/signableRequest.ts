import { AccountKind, SignatureRequestKind, SignaturePayloadKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { hyperliquidUnifiedAccount } from "./accountModeRules"
import { SIGNATURE_CHAIN_IDS } from "./constants"
import { SignableRefusal } from "./enums"
import { NotSignable } from "./errors"
import { laMargeMessage, laMargeTyped } from "./lamargeRules"
import { asterApproval, hyperliquidApproval, lighterProof, lighterRegistration, polymarketApproval } from "./setupRules"
import {
  asterTransfer,
  asterWithdrawal,
  hyperliquidDepositWithdrawal,
  hyperliquidGasPayment,
  hyperliquidTransfer,
  hyperliquidWithdrawal,
} from "./transferRules"
import type { RuleProps, Signable, SignableRequestProps, SignSummary } from "./types"
import { refuse } from "./utils"

/** A venue's delegated access, given or renewed (D2, D38): lebroker's agent, proxy or key, and nothing else. */
function setupSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return props.request.venue === VenueId.LIGHTER
      ? lighterRegistration({ ...props, message: payload.message })
      : refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  switch (props.request.venue) {
    case VenueId.HYPERLIQUID:
      return hyperliquidApproval(typed)
    case VenueId.ASTER:
      return asterApproval(typed)
    case VenueId.POLYMARKET_PERPS:
      return polymarketApproval(typed)
    case VenueId.LIGHTER:
      return lighterProof(typed)
    case null:
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
}

/**
 * A transfer from Main to one of the user's own sub-accounts (D19, D32), where its destination can be read before it's
 * signed. Polymarket Perps signs a hash of its command, which can't be: the browser refuses it.
 */
function transferSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  switch (props.request.venue) {
    case VenueId.HYPERLIQUID:
      return hyperliquidTransfer(typed)
    case VenueId.ASTER:
      return asterTransfer(typed)
    case VenueId.POLYMARKET_PERPS:
      return refuse({ refusal: SignableRefusal.OPAQUE })
    case null:
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
}

/**
 * A withdrawal of Main's, to Main's own wallet only (D3, D31); or Hyperliquid's straight into a venue's deposit address
 * for Main, which opens Main's account there (D49), where the request names that venue.
 */
function withdrawalSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  if (payload.depositVenue !== undefined) {
    return props.request.venue === VenueId.HYPERLIQUID
      ? hyperliquidDepositWithdrawal({ ...typed, depositVenue: payload.depositVenue })
      : refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  }
  switch (props.request.venue) {
    case VenueId.HYPERLIQUID:
      return hyperliquidWithdrawal(typed)
    case VenueId.ASTER:
      return asterWithdrawal(typed)
    case null:
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
}

/**
 * Main's payment to lebroker's gas reserve for gas sent to its wallet (D51, phase 6): from Main's Hyperliquid account,
 * readable before it's signed, to the reserve this deployment pins only.
 */
function gasPurchaseSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  if (props.request.venue !== VenueId.HYPERLIQUID) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
  return hyperliquidGasPayment({ ...props, typedData: payload.typedData, gas: payload.gas ?? null })
}

/** Main's own venue account switched to the mode lebroker runs it in (D66): Hyperliquid's unified account only. */
function accountModeSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  if (props.request.venue !== VenueId.HYPERLIQUID) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
  return hyperliquidUnifiedAccount({ ...props, typedData: payload.typedData })
}

/** A LaMarge move out of one of Main's venues (D2, D20). */
function laMargeSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  return payload.kind === SignaturePayloadKind.TYPED_DATA
    ? laMargeTyped({ ...props, typedData: payload.typedData, take: payload.take ?? null, lamarge: payload.lamarge ?? null })
    : laMargeMessage({ ...props, message: payload.message, take: payload.take ?? null, lamarge: payload.lamarge ?? null })
}

function summaryOf(props: RuleProps): SignSummary {
  if (!props.accounts.some(account => account.id === props.request.accountId && account.kind === AccountKind.MAIN)) {
    refuse({ refusal: SignableRefusal.OTHER_ACCOUNT })
  }
  switch (props.request.kind) {
    case SignatureRequestKind.VENUE_SETUP:
    case SignatureRequestKind.VENUE_RENEWAL:
      return setupSummary(props)
    case SignatureRequestKind.TRANSFER:
      return transferSummary(props)
    case SignatureRequestKind.WITHDRAWAL:
      return withdrawalSummary(props)
    case SignatureRequestKind.LAMARGE_MOVE:
      return laMargeSummary(props)
    case SignatureRequestKind.GAS_PURCHASE:
      return gasPurchaseSummary(props)
    case SignatureRequestKind.ACCOUNT_MODE:
      return accountModeSummary(props)
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_KIND })
  }
}

/**
 * Whether Main's wallet may sign a request, read from the request alone (D2): a strict allowlist of what lebroker asks
 * for each kind, its exact domain and types, its destinations among the user's own accounts or Main itself, or the gas
 * reserve the asking deployment pins (D51), and the one
 * chain it may be signed on, the wallet's own or one of `SIGNATURE_CHAIN_IDS`. A request the service built otherwise, as a compromised host would, is refused before the
 * wallet opens, and the summary says what is signed in place of the service's words.
 */
function signableRequest(props: SignableRequestProps): Signable {
  try {
    const askedAt = Date.parse(props.request.createdAt)
    // Every lifetime lebroker asks for is bounded from when it asked: a request that doesn't say when can't be bounded.
    if (!Number.isFinite(askedAt)) {
      refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
    }
    const summary = summaryOf({ ...props, askedAt, now: props.now ?? Date.now() })
    // Signed on the chain the wallet shows, or on one the wallet can be switched to: never another.
    if (summary.chainId !== null && summary.chainId !== props.walletChainId && !SIGNATURE_CHAIN_IDS.has(summary.chainId)) {
      refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
    }
    return { ok: true, summary }
  } catch (error) {
    return { ok: false, refusal: error instanceof NotSignable ? error.message : SignableRefusal.UNKNOWN_SHAPE }
  }
}

export { signableRequest }
