import {
  CHAINS,
  COLLATERAL_ROUTE,
  TAKER_API_KEY,
  USDC_ASSET,
  asterTransfer,
  checkAsterApproval,
  checkAsterTakeIntent,
  checkEscrowTyped,
  checkLighterTakeIntent,
  checkLoginChallenge,
  checkPermit,
  checkWithdrawal,
  decimalsOf,
  fromHex,
  takePayments,
  toHex,
  transferMessage,
  uint,
  withdrawalCost,
  type Typed,
} from "@lamarge/sdk/protocol"
import { SignatureRequestReason } from "../lebroker/accounts/model"
import { shortAddress } from "../lebroker/core/model"
import { LIGHTER_REGISTRATION_MESSAGE } from "../lebroker/signer/model"
import { formatUnits } from "viem"
import { EIP712_DOMAIN_FIELDS, LAMARGE_APP_ORIGINS, LAMARGE_PERMIT_SECONDS, LIGHTER_TRANSFER_MESSAGE } from "./constants"
import { LaMargeWord, SignableRefusal, SignStarter, SignSummaryLabel, SignSummaryText } from "./enums"
import type {
  ChainOfProps,
  HexIndexProps,
  LaMargeMessageRuleProps,
  LaMargeTypedProps,
  LaMargeTypedRuleProps,
  LighterTakeProps,
  SignSummary,
  StartedByProps,
  SummaryLine,
  UnitsProps,
  VenueOfProps,
} from "./types"
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

/** Who started the move, as the request says it: the margin keeper, or the user; nothing for a reason of another kind. */
function startedBy({ reason }: StartedByProps): SummaryLine[] {
  switch (reason) {
    case SignatureRequestReason.MARGIN_KEEPER:
      return [{ label: SignSummaryLabel.STARTED_BY, value: SignStarter.MARGIN_KEEPER }]
    case SignatureRequestReason.MOVE:
      return [{ label: SignSummaryLabel.STARTED_BY, value: SignStarter.USER }]
    case SignatureRequestReason.SETUP:
    case SignatureRequestReason.RENEWAL:
    default:
      return []
  }
}

/**
 * A LaMarge take paid inside Aster: with one paid inside Lighter, the only case where Main pays someone who isn't one of
 * the user's accounts, the maker who fills the take, peer to peer, before LaMarge releases what Main receives (D20). Only a transfer of exactly
 * the take's one fill, from Main, to that fill's maker recipient, under its id, with Main its taker and receiver, within
 * its windows, as LaMarge's SDK checks a take's payment (`checkAsterTakeIntent`). The take is the request's, as
 * LaMarge's API answered it: no maker's signature binds its recipient, so the summary names it.
 */
function asterTake({ typed, user, take, askedAt, request }: LaMargeTypedProps): SignSummary {
  const transfer = laMargeCheck({ check: () => asterTransfer(typed) })
  if (!isAddress({ address: transfer.user, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (take === null) {
    return refuse({ refusal: SignableRefusal.NO_TAKE })
  }
  const item = { kind: LaMargeWord.ASTER_TRANSFER, signer: user.address, fill_id: take.fills[0]?.id, typed_data: typed }
  laMargeCheck({ check: () => checkAsterTakeIntent([item], take.fills, take.input, user.address, user.address, askedAt / 1000) })
  return {
    action: SignSummaryText.LAMARGE_ASTER_TAKE,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: units({ value: transfer.amount, venue: LaMargeWord.ASTER }) },
      { label: SignSummaryLabel.MAKER, value: shortAddress({ address: transfer.to }) },
      ...startedBy({ reason: request.reason }),
    ],
    chainId: typed.domain.chainId,
  }
}

/** An index or a nonce of a Lighter message, written in hex: a whole number a wallet reads exactly, or refused. */
function hexIndex({ hex }: HexIndexProps): number {
  const value = Number.parseInt(hex ?? "", 16)
  return Number.isSafeInteger(value) ? value : refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
}

/**
 * A LaMarge take paid inside Lighter: as inside Aster, Main pays the maker who fills the take, peer to peer, before
 * LaMarge releases what Main receives (D20), by Lighter's owner message for the transfer LaMarge's key sends from Main's
 * account. Only that message as LaMarge's SDK writes it, read field by field and written again the same: LaMarge's key
 * at its pinned index, USDC between collateral routes, on Lighter's chain. It goes from Main's Lighter account to the
 * maker's, as the take names them, and pays exactly the take's one fill, under its id, with Main its taker and receiver,
 * within its windows and Lighter's fee cap, as LaMarge's SDK checks a take's payment (`checkLighterTakeIntent`). The
 * take and its accounts are the request's, as LaMarge's API and Lighter's answered the executor: Main's wallet can't
 * read Lighter, so the summary names the maker's account.
 */
function lighterTake({ read, message, user, take, askedAt, request }: LighterTakeProps): SignSummary {
  const transfer = {
    from: hexIndex({ hex: read[2] }),
    apiKey: TAKER_API_KEY,
    to: hexIndex({ hex: read[3] }),
    asset: USDC_ASSET,
    fromRoute: COLLATERAL_ROUTE,
    toRoute: COLLATERAL_ROUTE,
    amount: BigInt(`0x${read[4] ?? ""}`),
    fee: BigInt(`0x${read[5] ?? ""}`),
    memo: fromHex(read[6] ?? ""),
    expiredAt: 0,
    nonce: hexIndex({ hex: read[1] }),
  }
  if (transferMessage(transfer) !== message) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  if (take === null) {
    return refuse({ refusal: SignableRefusal.NO_TAKE })
  }
  const accounts = take.lighter ?? refuse({ refusal: SignableRefusal.NOT_TAKE_ACCOUNTS })
  if (transfer.from !== accounts.from_account_index || transfer.to !== accounts.to_account_index) {
    refuse({ refusal: SignableRefusal.NOT_TAKE_ACCOUNTS })
  }
  const terms = {
    from_account_index: transfer.from,
    amount: String(transfer.amount),
    usdc_fee: String(transfer.fee),
    memo: toHex(transfer.memo),
  }
  const item = { kind: LaMargeWord.LIGHTER_TRANSFER, signer: user.address, fill_id: take.fills[0]?.id, typed_data: terms }
  laMargeCheck({
    check: () =>
      checkLighterTakeIntent([item], take.fills, take.input, user.address, user.address, accounts.from_account_index, askedAt / 1000),
  })
  return {
    action: SignSummaryText.LAMARGE_LIGHTER_TAKE,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: units({ value: transfer.amount, venue: LaMargeWord.LIGHTER }) },
      { label: SignSummaryLabel.LIGHTER_FEE, value: units({ value: transfer.fee, venue: LaMargeWord.LIGHTER }) },
      { label: SignSummaryLabel.MAKER_LIGHTER, value: String(transfer.to) },
      ...startedBy({ reason: request.reason }),
    ],
    chainId: null,
  }
}

/** Aster: a take's payment to its maker, or the approval of LaMarge's agent, which never withdraws. */
function asterMessage(props: LaMargeTypedProps): SignSummary {
  const aster = CHAINS[LaMargeWord.ASTER] ?? refuse({ refusal: SignableRefusal.UNKNOWN_VENUE })
  if (props.typed.domain.chainId !== aster.id) {
    return asterTake(props)
  }
  const message = text({ value: props.typed.message.msg })
  const nonce = new URLSearchParams(message).get("nonce") ?? ""
  laMargeCheck({
    check: () => checkAsterApproval({ message, nonce, expires_at: "", typed_data: props.typed }, props.user.address, props.askedAt),
  })
  return { action: SignSummaryText.LAMARGE_ASTER_AGENT, lines: [], chainId: props.typed.domain.chainId }
}

/**
 * What Main signs for a LaMarge move (D2, D20): only what LaMarge's own SDK checks against its pinned deployment, and
 * whose funds go to its pinned escrow, back to Main, or, for a take paid inside Aster or Lighter, to the maker who
 * fills it.
 */
function laMargeTyped(props: LaMargeTypedRuleProps): SignSummary {
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

/**
 * A message for LaMarge: Main's sign-in on LaMarge's app, the registration of LaMarge's Lighter key at its index, or
 * the payment of a take inside Lighter to its maker.
 */
function laMargeMessage(props: LaMargeMessageRuleProps): SignSummary {
  const message = props.message
  const transfer = LIGHTER_TRANSFER_MESSAGE.exec(message)
  if (transfer !== null) {
    return lighterTake({ ...props, read: transfer })
  }
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
    address: props.user.address,
    nonce: lines[8]?.slice(LaMargeWord.NONCE_PREFIX.length) ?? "",
    expires_at: lines[10]?.slice(LaMargeWord.EXPIRES_PREFIX.length) ?? "",
  }
  laMargeCheck({ check: () => checkLoginChallenge(challenge, origin, props.askedAt) })
  return { action: SignSummaryText.LAMARGE_SIGN_IN, lines: [], chainId: null }
}

export { laMargeMessage, laMargeTyped }
