import { inspectDirectTransaction } from "@lamarge/sdk/direct"
import { formatUnits } from "viem"
import { AccountKind, SignatureRequestKind, SignaturePayloadKind } from "../lebroker/accounts/model"
import { VenueId } from "../lebroker/core/model"
import { GMX_PERMIT_PRIMARY_TYPE } from "../lebroker/venues/model"
import { hyperliquidUnifiedAccount } from "./accountModeRules"
import { HYPERLIQUID_CCTP_TYPE, OP_TYPE, POLYMARKET_PERPS_WITHDRAW_TYPE, SIGNATURE_CHAIN_IDS } from "./constants"
import { SignableRefusal } from "./enums"
import { NotSignable } from "./errors"
import { laMargeMessage, laMargeTyped } from "./lamargeRules"
import { LIGHTER_REGISTRATION_MESSAGE } from "../lebroker/signer/model"
import {
  asterApproval,
  gmxApproval,
  gmxUsdcPermit,
  hyperliquidApproval,
  lighterProof,
  lighterRegistration,
  polymarketApproval,
  polymarketDeletion,
} from "./setupRules"
import {
  asterTransfer,
  asterWithdrawal,
  hyperliquidCctpDeposit,
  hyperliquidDepositWithdrawal,
  hyperliquidTransfer,
  hyperliquidWithdrawal,
  lighterFastWithdrawal,
  lighterTransfer,
  polymarketBridgeDeposit,
  polymarketPerpsToWallet,
} from "./transferRules"
import type { RuleProps, Signable, SignableRequestProps, SignSummary } from "./types"
import { refuse, stepped, withApprovals } from "./utils"

/** A venue's delegated access, given or renewed: lebroker's agent, proxy or key, and nothing else. */
function setupSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return props.request.venue === VenueId.LIGHTER
      ? lighterRegistration({ ...props, message: payload.message })
      : refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  switch (props.request.venue) {
    case VenueId.HYPERLIQUID:
      return hyperliquidApproval(typed)
    case VenueId.ASTER:
      return asterApproval(typed)
    case VenueId.POLYMARKET_PERPS:
      return payload.typedData.primaryType === OP_TYPE
        ? polymarketDeletion({ ...typed, deletes: payload.deletes })
        : polymarketApproval(typed)
    case VenueId.LIGHTER:
      return lighterProof(typed)
    case VenueId.GMX:
      return payload.typedData.primaryType === GMX_PERMIT_PRIMARY_TYPE
        ? gmxUsdcPermit({ ...typed, permit: payload.gmxUsdcPermit })
        : gmxApproval({ ...typed, approval: payload.gmxSubaccountApproval })
    case null:
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
}

/**
 * A transfer from Main to one of the user's own sub-accounts, or one shared with them, where its destination can be
 * read before it's signed. Polymarket Perps signs a hash of its command, which can't be: the browser refuses it. Lighter's goes by
 * Main's transfer key, which Main's first transfer there makes: Main proves its Lighter account its own, registers the
 * key, then signs the transfer's owner message, each a request of the transfer's own.
 */
function transferSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    if (props.request.venue !== VenueId.LIGHTER) {
      return refuse({ refusal: SignableRefusal.OPAQUE })
    }
    const message = { ...props, message: payload.message }
    return LIGHTER_REGISTRATION_MESSAGE.test(payload.message) ? lighterRegistration(message) : lighterTransfer(message)
  }
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  switch (props.request.venue) {
    case VenueId.HYPERLIQUID:
      return hyperliquidTransfer(typed)
    case VenueId.ASTER:
      return asterTransfer(typed)
    case VenueId.LIGHTER:
      return lighterProof(typed)
    case VenueId.POLYMARKET_PERPS:
      return refuse({ refusal: SignableRefusal.OPAQUE })
    case null:
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  }
}

/**
 * A withdrawal of Main's, to Main's own wallet only; or straight into a venue's deposit address for Main, where the
 * request names that venue: Hyperliquid's `withdraw3` or CCTP send, or Lighter's fast withdrawal, its owner message.
 */
function withdrawalSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return props.request.venue === VenueId.LIGHTER && payload.depositVenue !== undefined
      ? lighterFastWithdrawal({ ...props, message: payload.message, depositVenue: payload.depositVenue })
      : refuse({ refusal: SignableRefusal.OPAQUE })
  }
  if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const typed = { ...props, typedData: payload.typedData }
  if (payload.depositVenue !== undefined) {
    const into = { ...typed, depositVenue: payload.depositVenue }
    if (props.request.venue === VenueId.POLYMARKET_PERPS) {
      // Main's Perps margin withdrawn to its Deposit Wallet first, then the wallet's batch through the bridge.
      return payload.typedData.primaryType === POLYMARKET_PERPS_WITHDRAW_TYPE
        ? polymarketPerpsToWallet(into)
        : polymarketBridgeDeposit(into)
    }
    if (props.request.venue !== VenueId.HYPERLIQUID) {
      return refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
    }
    return payload.typedData.primaryType === HYPERLIQUID_CCTP_TYPE ? hyperliquidCctpDeposit(into) : hyperliquidDepositWithdrawal(into)
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

/** A LaMarge move out of one of Main's venues. */
function laMargeSummary(props: RuleProps): SignSummary {
  const payload = props.request.payload
  if (payload.kind === SignaturePayloadKind.TRANSACTION) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  return payload.kind === SignaturePayloadKind.TYPED_DATA
    ? laMargeTyped({
        ...props,
        typedData: payload.typedData,
        take: payload.take ?? null,
        lamarge: payload.lamarge ?? null,
        send: payload.send ?? null,
      })
    : laMargeMessage({ ...props, message: payload.message, take: payload.take ?? null, lamarge: payload.lamarge ?? null })
}

function summaryOf(props: RuleProps): SignSummary {
  if (!props.accounts.some(account => account.id === props.request.accountId && account.kind === AccountKind.MAIN)) {
    refuse({ refusal: SignableRefusal.OTHER_ACCOUNT })
  }
  if (props.request.payload.kind === SignaturePayloadKind.TRANSACTION) {
    if (props.request.kind !== SignatureRequestKind.LAMARGE_MOVE) {
      return refuse({ refusal: SignableRefusal.OPAQUE })
    }
    const terms = inspectDirectTransaction(props.request.payload.transaction, props.user.address, props.now)
    // GMX withdrawals have no application nonce; browser prompts need a server-wide claim before exposing them.
    if (terms.step === "withdrawal") {
      return refuse({ refusal: SignableRefusal.OPAQUE })
    }
    return {
      action: `LaMarge ${terms.step}`,
      chainId: props.request.payload.transaction.chainId,
      lines: [
        { label: "Venue", value: terms.venue },
        { label: "Token", value: terms.token },
        { label: "Amount", value: formatUnits(terms.amount, 6) },
        { label: "Recipient", value: terms.recipient },
        { label: "Minimum received", value: formatUnits(terms.minimum, 6) },
        { label: "Network fee", value: "Paid by your wallet" },
      ],
    }
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
    case SignatureRequestKind.ACCOUNT_MODE:
      return accountModeSummary(props)
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_KIND })
  }
}

/**
 * Whether Main's wallet may sign a request, read from the request alone: a strict allowlist of what lebroker asks
 * for each kind, its exact domain and types, its destinations among the user's own accounts, the sub-accounts shared
 * with them, or Main itself, and the one chain it may be signed on, the wallet's own or one of `SIGNATURE_CHAIN_IDS`. A
 * request the service built otherwise, as a compromised host would, is refused before the wallet opens, and the summary
 * says what is signed in place of the service's words.
 */
function signableRequest(props: SignableRequestProps): Signable {
  try {
    const askedAt = Date.parse(props.request.createdAt)
    // Every lifetime lebroker asks for is bounded from when it asked: a request that doesn't say when can't be bounded.
    if (!Number.isFinite(askedAt)) {
      refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
    }
    const summary = stepped({
      summary: summaryOf({ ...props, accounts: withApprovals(props), askedAt, now: props.now ?? Date.now() }),
      step: props.request.payload.step,
    })
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
