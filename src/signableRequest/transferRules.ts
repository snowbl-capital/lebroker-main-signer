import { Network } from "../lebroker/core/model"
import {
  ASTER_MARGIN_ASSET,
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_CHAIN_IDS,
  ASTER_SIGN_DOMAIN,
  ASTER_WITHDRAWAL_ACTION,
  ASTER_WITHDRAWAL_DOMAIN,
  ASTER_WITHDRAWAL_TYPES,
  HYPERLIQUID_SEND_ASSET_TYPES,
  HYPERLIQUID_SEND_DEX,
  HYPERLIQUID_USDC,
  HYPERLIQUID_USER_SIGNED_DOMAIN,
  HYPERLIQUID_WITHDRAW_TYPES,
} from "../lebroker/venues/model"
import { ASTER_TRANSFER_FIELDS, HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID, HYPERLIQUID_MAINNET, USDC } from "./constants"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import type { SignSummary, TypedRuleProps } from "./types"
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

/** Hyperliquid's user-signed actions: signed on the chain the wallet shows, or on Arbitrum, Hyperliquid's own; on mainnet. */
function hyperliquidChain({ typedData, walletChainId }: TypedRuleProps): number {
  const chainId = allowedChain({ chainId: chainOf({ typedData }), allowed: [walletChainId, HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID] })
  expectDomain({ typedData, domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId } })
  if (typedData.message.hyperliquidChain !== HYPERLIQUID_MAINNET) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return chainId
}

/** Hyperliquid's `sendAsset` of USDC, spot to spot, from Main to one of the user's own sub-accounts (D19). */
function hyperliquidTransfer(props: TypedRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({ typedData: props.typedData, types: HYPERLIQUID_SEND_ASSET_TYPES, primaryType: "HyperliquidTransaction:SendAsset" })
  if (
    props.typedData.message.sourceDex !== HYPERLIQUID_SEND_DEX ||
    props.typedData.message.destinationDex !== HYPERLIQUID_SEND_DEX ||
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

/** Aster's Spot transfer of USDT, signed by Main's wallet, to one of the user's own sub-accounts (D32). */
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

/** Hyperliquid's `withdraw3`, to Main's own address only (D3, D31). */
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

/** Aster's withdrawal, signed by Main, to Main's own address only (D3, D31). */
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

export { asterTransfer, asterWithdrawal, hyperliquidTransfer, hyperliquidWithdrawal }
