import {
  CHAINS,
  TAKER_API_KEY,
  asterTransfer,
  checkAsterApproval,
  checkEscrowTyped,
  checkLoginChallenge,
  checkPermit,
  checkWithdrawal,
  decimalsOf,
  takePayments,
  uint,
  withdrawalCost,
  type Typed,
} from "@lamarge/sdk/protocol"
import { shortAddress } from "../lebroker/core/model"
import { LIGHTER_REGISTRATION_MESSAGE } from "../lebroker/signer/model"
import { formatUnits } from "viem"
import { EIP712_DOMAIN_FIELDS, LAMARGE_APP_ORIGINS, LAMARGE_PERMIT_SECONDS } from "./constants"
import { LaMargeWord, SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import type { ChainOfProps, LaMargeTypedProps, MessageRuleProps, SignSummary, TypedRuleProps, UnitsProps, VenueOfProps } from "./types"
import { chainOf, isAddress, laMargeCheck, refuse, text } from "./utils"

/**
 * Typed data as LaMarge's SDK checks it: its domain's four fields and none more, the chain id a number, and the domain's
 * own type named, as the wallet writes it.
 */
function sdkTyped({ typedData }: ChainOfProps): Typed {
  const names = Object.keys(typedData.domain)
  if (names.some(name => !EIP712_DOMAIN_FIELDS.some(field => field.name === name))) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return {
    types: {
      EIP712Domain: EIP712_DOMAIN_FIELDS.filter(field => names.includes(field.name)),
      ...Object.fromEntries(
        Object.entries(typedData.types)
          .filter(entry => entry[0] !== "EIP712Domain")
          .map(entry => [entry[0], [...entry[1]]]),
      ),
    },
    primaryType: typedData.primaryType,
    domain: {
      name: text({ value: typedData.domain.name }),
      ...(typedData.domain.version === undefined ? {} : { version: text({ value: typedData.domain.version }) }),
      chainId: chainOf({ typedData }),
      verifyingContract: text({ value: typedData.domain.verifyingContract }),
    },
    message: typedData.message,
  }
}

/** The LaMarge venue whose chain the domain names: its escrow's, its token's, or its withdrawal's. */
function venueOf({ typed }: VenueOfProps): string {
  const venue = Object.keys(CHAINS).find(name => CHAINS[name]?.id === typed.domain.chainId)
  return venue ?? refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
}

function units({ value, venue }: UnitsProps): string {
  return formatUnits(value, decimalsOf(venue))
}

/** The permit LaMarge's escrow takes Main's token with, only on moves Main signs: its pinned token and escrow (D20). */
function permit({ typed, user, askedAt }: LaMargeTypedProps): SignSummary {
  const venue = venueOf({ typed })
  laMargeCheck({
    check: () =>
      checkPermit(
        { kind: LaMargeWord.PERMIT, signer: user.address, typed_data: typed },
        venue,
        user.address,
        LAMARGE_PERMIT_SECONDS,
        askedAt / 1000,
      ),
  })
  return {
    action: SignSummaryText.LAMARGE_PERMIT,
    lines: [
      { label: SignSummaryLabel.TOKEN, value: shortAddress({ address: typed.domain.verifyingContract }) },
      { label: SignSummaryLabel.SPENDER, value: shortAddress({ address: text({ value: typed.message.spender }) }) },
    ],
    chainId: typed.domain.chainId,
  }
}

/** A take's payment into LaMarge's pinned escrow, paid by Main and nobody else. */
function payment({ typed, user }: LaMargeTypedProps): SignSummary {
  const venue = venueOf({ typed })
  laMargeCheck({ check: () => checkEscrowTyped(typed, venue) })
  const payments = laMargeCheck({ check: () => takePayments(typed) })
  if (
    !isAddress({ address: typed.message.payer, other: user.address }) ||
    !payments.every(paid => isAddress({ address: paid.payer, other: user.address }))
  ) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  const total = laMargeCheck({ check: () => payments.reduce((sum, paid) => sum + uint(paid.amount), 0n) })
  return {
    action: SignSummaryText.LAMARGE_PAYMENT,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: units({ value: total, venue }) },
      { label: SignSummaryLabel.PAYMENTS, value: String(payments.length) },
    ],
    chainId: typed.domain.chainId,
  }
}

/** A refund of Main's own payment from LaMarge's pinned escrow. */
function refund({ typed, user }: LaMargeTypedProps): SignSummary {
  const venue = venueOf({ typed })
  laMargeCheck({ check: () => checkEscrowTyped(typed, venue) })
  if (!isAddress({ address: typed.message.payer, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  return { action: SignSummaryText.LAMARGE_REFUND, lines: [], chainId: typed.domain.chainId }
}

/** A venue's withdrawal LaMarge relays: to Main's own wallet only, as the SDK's checks pin it, for what it says. */
function withdrawal({ typed, user, askedAt }: LaMargeTypedProps): SignSummary {
  const venue = venueOf({ typed })
  const cost = laMargeCheck({ check: () => withdrawalCost(venue, typed) })
  laMargeCheck({ check: () => checkWithdrawal(typed, venue, user.address, user.address, cost, askedAt / 1000) })
  return {
    action: SignSummaryText.WITHDRAW_TO_MAIN,
    lines: [{ label: SignSummaryLabel.AMOUNT, value: units({ value: cost, venue }) }],
    chainId: typed.domain.chainId,
  }
}

/** Aster: a payment into LaMarge's pinned Aster vault, or the approval of LaMarge's agent, which never withdraws. */
function asterMessage({ typed, user, askedAt }: LaMargeTypedProps): SignSummary {
  const aster = CHAINS[LaMargeWord.ASTER] ?? refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  if (typed.domain.chainId === aster.id) {
    const message = text({ value: typed.message.msg })
    const nonce = new URLSearchParams(message).get("nonce") ?? ""
    laMargeCheck({ check: () => checkAsterApproval({ message, nonce, expires_at: "", typed_data: typed }, user.address, askedAt) })
    return { action: SignSummaryText.LAMARGE_ASTER_AGENT, lines: [], chainId: typed.domain.chainId }
  }
  const transfer = laMargeCheck({ check: () => asterTransfer(typed) })
  if (!isAddress({ address: transfer.user, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (!isAddress({ address: transfer.to, other: aster.escrow })) {
    refuse({ refusal: SignableRefusal.NOT_YOUR_ACCOUNT })
  }
  return {
    action: SignSummaryText.LAMARGE_ASTER_PAYMENT,
    lines: [{ label: SignSummaryLabel.AMOUNT, value: units({ value: transfer.amount, venue: LaMargeWord.ASTER }) }],
    chainId: typed.domain.chainId,
  }
}

/**
 * What Main signs for a LaMarge move (D2, D20): only what LaMarge's own SDK checks against its pinned deployment, and
 * whose funds go to its pinned escrow or vault, or back to Main.
 */
function laMargeTyped(props: TypedRuleProps): SignSummary {
  const typed = sdkTyped(props)
  switch (typed.primaryType) {
    case LaMargeWord.PERMIT_TYPE:
      return permit({ ...props, typed })
    case LaMargeWord.PAY_TAKE_TYPE:
      return payment({ ...props, typed })
    case LaMargeWord.REFUND_TYPE:
      return refund({ ...props, typed })
    case LaMargeWord.SEND_ASSET_TYPE:
    case LaMargeWord.ACTION_TYPE:
    case LaMargeWord.WITHDRAW_TYPE:
      return withdrawal({ ...props, typed })
    case LaMargeWord.MESSAGE_TYPE:
      return asterMessage({ ...props, typed })
    default:
      return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
}

/** A message for LaMarge: Main's sign-in on LaMarge's app, or the registration of LaMarge's Lighter key at its index. */
function laMargeMessage({ message, user, askedAt }: MessageRuleProps): SignSummary {
  const registration = LIGHTER_REGISTRATION_MESSAGE.exec(message)
  if (registration !== null) {
    if (Number.parseInt(registration[3] ?? "", 16) !== TAKER_API_KEY) {
      refuse({ refusal: SignableRefusal.NOT_LEBROKER_KEY })
    }
    return {
      action: SignSummaryText.LAMARGE_LIGHTER_KEY,
      lines: [
        { label: SignSummaryLabel.ACCOUNT_INDEX, value: String(Number.parseInt(registration[2] ?? "", 16)) },
        { label: SignSummaryLabel.KEY_INDEX, value: String(TAKER_API_KEY) },
      ],
      chainId: null,
    }
  }
  const lines = message.split("\n")
  const origin = LAMARGE_APP_ORIGINS.find(own => lines[0] === `${new URL(own).host}${LaMargeWord.SIGN_IN_LINE}`)
  if (origin === undefined) {
    return refuse({ refusal: SignableRefusal.OPAQUE })
  }
  const challenge = {
    message,
    address: user.address,
    nonce: lines[8]?.slice(LaMargeWord.NONCE_PREFIX.length) ?? "",
    expires_at: lines[10]?.slice(LaMargeWord.EXPIRES_PREFIX.length) ?? "",
  }
  laMargeCheck({ check: () => checkLoginChallenge(challenge, origin, askedAt) })
  return { action: SignSummaryText.LAMARGE_SIGN_IN, lines: [], chainId: null }
}

export { laMargeMessage, laMargeTyped }
