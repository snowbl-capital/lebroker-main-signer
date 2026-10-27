import { Network, shortAddress } from "../lebroker/core/model"
import {
  ASTER_MARGIN_ASSET,
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_CHAIN_IDS,
  ASTER_SIGN_DOMAIN,
  ASTER_WITHDRAWAL_ACTION,
  ASTER_WITHDRAWAL_DOMAIN,
  ASTER_WITHDRAWAL_TYPES,
  HYPERLIQUID_SEND_ASSET_TYPES,
  HYPERLIQUID_SEND_DEXES,
  HYPERLIQUID_USDC,
  HYPERLIQUID_USER_SIGNED_DOMAIN,
  HYPERLIQUID_WITHDRAW_TYPES,
} from "../lebroker/venues/model"
import { WITHDRAWAL_DEPOSIT_MIN_USD } from "../lebroker/signer/model"
import { ASTER_TRANSFER_FIELDS, DEPOSIT_WITHDRAWAL_ACTIONS, HYPERLIQUID_MAINNET, SIGNATURE_CHAIN_IDS, USDC } from "./constants"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import type { DepositWithdrawalRuleProps, SignSummary, TypedRuleProps } from "./types"
import {
  allowedChain,
  amount,
  chainOf,
  expectDomain,
  expectTypes,
  isAddress,
  ownSubAccount,
  queryFields,
  refuse,
  text,
  toAccount,
} from "./utils"

/**
 * Hyperliquid's user-signed actions, on mainnet: signed on the chain the wallet shows, or on any chain lebroker signs on,
 * which the wallet is switched to. A move's earlier step may leave the wallet on another chain than the one it was
 * confirmed on, and Hyperliquid takes any.
 */
function hyperliquidChain({ typedData, walletChainId }: TypedRuleProps): number {
  const chainId = allowedChain({ chainId: chainOf({ typedData }), allowed: [walletChainId, ...SIGNATURE_CHAIN_IDS] })
  expectDomain({ typedData, domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId } })
  if (typedData.message.hyperliquidChain !== HYPERLIQUID_MAINNET) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return chainId
}

/**
 * Hyperliquid's `sendAsset` of USDC from Main to one of the user's own sub-accounts, between the balances where
 * each account's mode keeps its collateral: spot, or the main dex's perps.
 */
function hyperliquidTransfer(props: TypedRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({ typedData: props.typedData, types: HYPERLIQUID_SEND_ASSET_TYPES, primaryType: "HyperliquidTransaction:SendAsset" })
  if (
    !HYPERLIQUID_SEND_DEXES.includes(text({ value: props.typedData.message.sourceDex })) ||
    !HYPERLIQUID_SEND_DEXES.includes(text({ value: props.typedData.message.destinationDex })) ||
    props.typedData.message.token !== HYPERLIQUID_USDC ||
    props.typedData.message.fromSubAccount !== ""
  ) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  const to = ownSubAccount({ address: props.typedData.message.destination, accounts: props.accounts })
  return {
    action: SignSummaryText.TRANSFER,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: amount({ value: props.typedData.message.amount, symbol: USDC }) },
      { label: SignSummaryLabel.TO, value: toAccount({ account: to }) },
      { label: SignSummaryLabel.CHAIN, value: String(chainId) },
    ],
    chainId,
  }
}

/** Aster's Spot transfer of USDT, signed by Main's wallet, to one of the user's own sub-accounts. */
function asterTransfer({ typedData, user, accounts }: TypedRuleProps): SignSummary {
  const chainId = ASTER_SIGN_CHAIN_IDS[Network.MAINNET]
  expectDomain({ typedData, domain: { ...ASTER_SIGN_DOMAIN, chainId } })
  expectTypes({ typedData, types: ASTER_MESSAGE_TYPES, primaryType: "Message" })
  const fields = queryFields({ query: text({ value: typedData.message.msg }), names: ASTER_TRANSFER_FIELDS })
  if (!isAddress({ address: fields.user, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (fields.asset !== ASTER_MARGIN_ASSET) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  const to = ownSubAccount({ address: fields.toAddress, accounts })
  return {
    action: SignSummaryText.TRANSFER,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: amount({ value: fields.amount, symbol: ASTER_MARGIN_ASSET }) },
      { label: SignSummaryLabel.TO, value: toAccount({ account: to }) },
    ],
    chainId,
  }
}

/** Hyperliquid's `withdraw3`, to Main's own address only. */
function hyperliquidWithdrawal(props: TypedRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({ typedData: props.typedData, types: HYPERLIQUID_WITHDRAW_TYPES, primaryType: "HyperliquidTransaction:Withdraw" })
  if (!isAddress({ address: props.typedData.message.destination, other: props.user.address })) {
    refuse({ refusal: SignableRefusal.NOT_YOUR_ACCOUNT })
  }
  return {
    action: SignSummaryText.WITHDRAW_TO_MAIN,
    lines: [{ label: SignSummaryLabel.AMOUNT, value: amount({ value: props.typedData.message.amount, symbol: USDC }) }],
    chainId,
  }
}

/**
 * Hyperliquid's `withdraw3` of Main's straight into a venue's deposit address for Main, which opens Main's account there
 * from inside lebroker with no gas: a venue the signer's least lists, at least that least, on mainnet, and only to
 * the address the signing side read itself from that venue for Main's own address just now. An address the request
 * names alone is never taken: Lighter's intent address credits whichever L1 address it was made for.
 */
function hyperliquidDepositWithdrawal(props: DepositWithdrawalRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({ typedData: props.typedData, types: HYPERLIQUID_WITHDRAW_TYPES, primaryType: "HyperliquidTransaction:Withdraw" })
  const leastUsd = WITHDRAWAL_DEPOSIT_MIN_USD[props.depositVenue]
  const action = DEPOSIT_WITHDRAWAL_ACTIONS[props.depositVenue]
  if (leastUsd === undefined || action === undefined) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  }
  const paid = amount({ value: props.typedData.message.amount, symbol: USDC })
  if (Number(props.typedData.message.amount) < leastUsd) {
    refuse({ refusal: SignableRefusal.DEPOSIT_TOO_SMALL })
  }
  const read = props.depositAddress
  if (read === undefined || read.venue !== props.depositVenue) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_UNREAD })
  }
  if (!isAddress({ address: props.typedData.message.destination, other: read.address })) {
    refuse({ refusal: SignableRefusal.NOT_DEPOSIT_ADDRESS })
  }
  return {
    action,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: paid },
      { label: SignSummaryLabel.DEPOSIT_ADDRESS, value: shortAddress({ address: read.address }) },
      { label: SignSummaryLabel.CHAIN, value: String(chainId) },
    ],
    chainId,
  }
}

/** Aster's withdrawal, signed by Main, to Main's own address only. */
function asterWithdrawal({ typedData, user }: TypedRuleProps): SignSummary {
  expectDomain({ typedData, domain: ASTER_WITHDRAWAL_DOMAIN })
  expectTypes({ typedData, types: ASTER_WITHDRAWAL_TYPES, primaryType: "Action" })
  if (
    typedData.message.type !== ASTER_WITHDRAWAL_ACTION.type ||
    typedData.message["destination Chain"] !== ASTER_WITHDRAWAL_ACTION.chain ||
    typedData.message.token !== ASTER_WITHDRAWAL_ACTION.token ||
    typedData.message["aster chain"] !== ASTER_WITHDRAWAL_ACTION.asterChain
  ) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  if (!isAddress({ address: typedData.message.destination, other: user.address })) {
    refuse({ refusal: SignableRefusal.NOT_YOUR_ACCOUNT })
  }
  return {
    action: SignSummaryText.WITHDRAW_TO_MAIN,
    lines: [{ label: SignSummaryLabel.AMOUNT, value: amount({ value: typedData.message.amount, symbol: ASTER_WITHDRAWAL_ACTION.token }) }],
    chainId: ASTER_WITHDRAWAL_DOMAIN.chainId,
  }
}

export { asterTransfer, asterWithdrawal, hyperliquidChain, hyperliquidDepositWithdrawal, hyperliquidTransfer, hyperliquidWithdrawal }
