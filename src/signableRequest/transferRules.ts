import { COLLATERAL_ROUTE, USDC_ASSET, fromHex, transferMessage } from "@lamarge/sdk/protocol"
import { isLighterKeyIndex } from "../lebroker/accounts/model"
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
  HYPERLIQUID_CCTP_DOMAINS,
  HYPERLIQUID_CCTP_SEND,
  HYPERLIQUID_SEND_TO_EVM_TYPES,
  LIGHTER_FAST_WITHDRAW_MEMO_PADDING,
  LIGHTER_FAST_WITHDRAW_POOL_INDEX,
  POLYMARKET_DEPOSIT_WALLET_BATCH_SECONDS,
  POLYMARKET_DEPOSIT_WALLET_BATCH_TYPES,
  POLYMARKET_DEPOSIT_WALLET_CHAIN_ID,
  POLYMARKET_DEPOSIT_WALLET_DOMAIN,
  POLYMARKET_ERC20_TRANSFER_ABI,
  POLYMARKET_PERPS_WITHDRAW_DOMAIN,
  POLYMARKET_PERPS_WITHDRAW_FEE,
  POLYMARKET_PERPS_WITHDRAW_TYPES,
  POLYMARKET_PUSD,
  polymarketDepositWalletOf,
} from "../lebroker/venues/model"
import { LIGHTER_MAX_TRANSFER_FEE, LIGHTER_TRANSFER_MESSAGE, WITHDRAWAL_DEPOSIT_MIN_USD } from "../lebroker/signer/model"
import { decodeFunctionData, formatUnits, getAddress, isHex } from "viem"
import {
  ASTER_TRANSFER_FIELDS,
  CCTP_DEPOSIT_ACTIONS,
  CCTP_DEPOSIT_CHAIN_ID,
  HYPERLIQUID_CCTP_TYPE,
  DEPOSIT_WITHDRAWAL_ACTIONS,
  HYPERLIQUID_MAINNET,
  LIGHTER_TRANSFER_API_KEY,
  LIGHTER_FAST_ACTIONS,
  LIGHTER_FAST_MIN_UNITS,
  POLYMARKET_BRIDGE_ACTIONS,
  POLYMARKET_BRIDGE_MIN_UNITS,
  CLOCK_SLACK_MS,
  LIGHTER_USDC_DECIMALS,
  SIGNATURE_CHAIN_IDS,
  USDC,
} from "./constants"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import type {
  DepositMessageRuleProps,
  DepositWithdrawalRuleProps,
  LighterMessageProps,
  MessageRuleProps,
  SignSummary,
  TypedRuleProps,
} from "./types"
import {
  allowedChain,
  amount,
  atMost,
  chainOf,
  expectDomain,
  expectTypes,
  hexIndex,
  isAddress,
  recipientSubAccount,
  queryFields,
  refuse,
  text,
  toAccount,
  wholeNumber,
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
 * Hyperliquid's `sendAsset` of USDC from Main to one of the user's own sub-accounts, or one shared with them, between
 * the balances where each account's mode keeps its collateral: spot, or the main dex's perps.
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
  const to = recipientSubAccount({ address: props.typedData.message.destination, accounts: props.accounts })
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

/** Aster's Spot transfer of USDT, signed by Main's wallet, to one of the user's own sub-accounts or one shared with them. */
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
  const to = recipientSubAccount({ address: fields.toAddress, accounts })
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
 * the address the signing side read itself for Main's own address just now: Lighter's from Lighter, Bybit's the one
 * Main signed, its signature recovered in the browser. An address the request names alone is never taken: Lighter's
 * intent address credits whichever L1 address it was made for.
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

/**
 * Hyperliquid's `sendToEvmWithData` of Main's USDC through Circle's CCTP straight into a venue's deposit address for
 * Main: a venue measured to credit a CCTP mint only, Bybit, at least the signer's least for it, on mainnet, from spot, to
 * a hex address with no call data and lebroker's gas limit, on the CCTP domain of the one chain Main signed the address
 * on, and only to the address the browser took once Main's own signature of it recovered Main. The request's word for
 * the address is never taken.
 */
function hyperliquidCctpDeposit(props: DepositWithdrawalRuleProps): SignSummary {
  const chainId = hyperliquidChain(props)
  expectTypes({
    typedData: props.typedData,
    types: HYPERLIQUID_SEND_TO_EVM_TYPES,
    primaryType: HYPERLIQUID_CCTP_TYPE,
  })
  const action = CCTP_DEPOSIT_ACTIONS[props.depositVenue]
  const leastUsd = WITHDRAWAL_DEPOSIT_MIN_USD[props.depositVenue]
  if (action === undefined || leastUsd === undefined) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  }
  const message = props.typedData.message
  if (
    message.token !== HYPERLIQUID_CCTP_SEND.token ||
    message.sourceDex !== HYPERLIQUID_CCTP_SEND.sourceDex ||
    message.addressEncoding !== HYPERLIQUID_CCTP_SEND.addressEncoding ||
    message.data !== HYPERLIQUID_CCTP_SEND.data ||
    wholeNumber({ value: message.gasLimit }) !== HYPERLIQUID_CCTP_SEND.gasLimit
  ) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  if (wholeNumber({ value: message.destinationChainId }) !== HYPERLIQUID_CCTP_DOMAINS.get(CCTP_DEPOSIT_CHAIN_ID)) {
    refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
  }
  const paid = amount({ value: message.amount, symbol: USDC })
  if (Number(message.amount) < leastUsd) {
    refuse({ refusal: SignableRefusal.DEPOSIT_TOO_SMALL })
  }
  const read = props.depositAddress
  if (read === undefined || read.venue !== props.depositVenue) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_UNREAD })
  }
  if (!isAddress({ address: message.destinationRecipient, other: read.address })) {
    refuse({ refusal: SignableRefusal.NOT_DEPOSIT_ADDRESS })
  }
  return {
    action,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: paid },
      { label: SignSummaryLabel.DEPOSIT_ADDRESS, value: shortAddress({ address: read.address }) },
      { label: SignSummaryLabel.DESTINATION_CHAIN, value: String(CCTP_DEPOSIT_CHAIN_ID) },
      { label: SignSummaryLabel.CHAIN, value: String(chainId) },
    ],
    chainId,
  }
}

/**
 * Main's Polymarket Deposit Wallet batch, straight into a venue's deposit address for Main through Polymarket's bridge:
 * a venue measured to credit the bridge's payout only, Bybit; for Main's own Deposit Wallet, derived in the browser
 * from Main's address, on Polygon; one call only, a transfer of pUSD of at least the bridge's least, with no value; to
 * the address Polymarket's bridge answered the browser itself as paying the Bybit deposit address Main signed; lasting
 * no longer than lebroker asks. The request's word for either address is never taken.
 */
function polymarketBridgeDeposit({ typedData, user, depositVenue, depositAddress, askedAt }: DepositWithdrawalRuleProps): SignSummary {
  const action = POLYMARKET_BRIDGE_ACTIONS[depositVenue] ?? refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  const wallet = polymarketDepositWalletOf({ owner: getAddress(user.address) })
  expectDomain({
    typedData,
    domain: { ...POLYMARKET_DEPOSIT_WALLET_DOMAIN, chainId: POLYMARKET_DEPOSIT_WALLET_CHAIN_ID, verifyingContract: wallet },
  })
  expectTypes({ typedData, types: POLYMARKET_DEPOSIT_WALLET_BATCH_TYPES, primaryType: "Batch" })
  if (!isAddress({ address: typedData.message.wallet, other: wallet })) {
    refuse({ refusal: SignableRefusal.NOT_DEPOSIT_WALLET })
  }
  wholeNumber({ value: typedData.message.nonce })
  const deadline = wholeNumber({ value: typedData.message.deadline })
  atMost({ value: deadline * 1000, max: askedAt + POLYMARKET_DEPOSIT_WALLET_BATCH_SECONDS * 1000 + CLOCK_SLACK_MS })
  const calls = typedData.message.calls
  const call: unknown = Array.isArray(calls) && calls.length === 1 ? calls[0] : refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  if (
    typeof call !== "object" ||
    call === null ||
    !("target" in call) ||
    !("value" in call) ||
    !("data" in call) ||
    Object.keys(call).length !== 3 ||
    !isAddress({ address: call.target, other: POLYMARKET_PUSD }) ||
    wholeNumber({ value: call.value }) !== 0 ||
    typeof call.data !== "string" ||
    !isHex(call.data)
  ) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  const transfer = (() => {
    try {
      return decodeFunctionData({ abi: POLYMARKET_ERC20_TRANSFER_ABI, data: call.data })
    } catch {
      return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
    }
  })()
  const to = transfer.args[0]
  const paid = transfer.args[1]
  if (paid < POLYMARKET_BRIDGE_MIN_UNITS) {
    refuse({ refusal: SignableRefusal.DEPOSIT_TOO_SMALL })
  }
  if (depositAddress === undefined || depositAddress.venue !== depositVenue || depositAddress.payTo === undefined) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_UNREAD })
  }
  if (!isAddress({ address: to, other: depositAddress.payTo })) {
    refuse({ refusal: SignableRefusal.NOT_BRIDGE_ADDRESS })
  }
  return {
    action,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: `${formatUnits(paid, LIGHTER_USDC_DECIMALS)} pUSD` },
      { label: SignSummaryLabel.DEPOSIT_ADDRESS, value: shortAddress({ address: depositAddress.address }) },
      { label: SignSummaryLabel.BRIDGE_ADDRESS, value: shortAddress({ address: depositAddress.payTo }) },
    ],
    chainId: POLYMARKET_DEPOSIT_WALLET_CHAIN_ID,
  }
}

/**
 * Main's withdrawal of its Polymarket Perps margin to its own Deposit Wallet, the step before Polymarket's bridge pays a
 * venue's deposit address for Main from there: only for a venue the bridge pays straight, Bybit; in the Perps deposit
 * contract's domain on Polygon, its fields exactly; from Main's own account, in pUSD, with no fee, to the Deposit Wallet
 * the browser derives from Main's address, never the request's word; signed no later than it's asked.
 */
function polymarketPerpsToWallet({ typedData, user, depositVenue, askedAt }: DepositWithdrawalRuleProps): SignSummary {
  if (POLYMARKET_BRIDGE_ACTIONS[depositVenue] === undefined) {
    refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  }
  expectDomain({ typedData, domain: POLYMARKET_PERPS_WITHDRAW_DOMAIN })
  expectTypes({ typedData, types: POLYMARKET_PERPS_WITHDRAW_TYPES, primaryType: "Withdraw" })
  const message = typedData.message
  if (!isAddress({ address: message.account, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (!isAddress({ address: message.to, other: polymarketDepositWalletOf({ owner: getAddress(user.address) }) })) {
    refuse({ refusal: SignableRefusal.NOT_DEPOSIT_WALLET })
  }
  const paid = BigInt(wholeNumber({ value: message.amount }))
  if (
    !isAddress({ address: message.token, other: POLYMARKET_PUSD }) ||
    BigInt(wholeNumber({ value: message.fee })) !== POLYMARKET_PERPS_WITHDRAW_FEE ||
    paid <= 0n
  ) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  wholeNumber({ value: message.salt })
  atMost({ value: wholeNumber({ value: message.ts }) * 1000, max: askedAt + CLOCK_SLACK_MS })
  return {
    action: SignSummaryText.POLYMARKET_PERPS_TO_WALLET,
    lines: [{ label: SignSummaryLabel.AMOUNT, value: `${formatUnits(paid, LIGHTER_USDC_DECIMALS)} pUSD` }],
    chainId: POLYMARKET_PERPS_WITHDRAW_DOMAIN.chainId,
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

/**
 * Lighter's owner message for a transfer of Main's transfer key, read field by field and written again the same, from
 * one of lebroker's keys on Main, within the fee Lighter ever charges; its memo as written, in hex.
 */
function lighterTransferRead({ message }: LighterMessageProps) {
  const read = LIGHTER_TRANSFER_MESSAGE.exec(message) ?? refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  const apiKey = hexIndex({ hex: LIGHTER_TRANSFER_API_KEY.exec(message)?.[1] })
  if (!isLighterKeyIndex({ apiKeyIndex: apiKey })) {
    refuse({ refusal: SignableRefusal.NOT_LEBROKER_KEY })
  }
  const transfer = {
    from: hexIndex({ hex: read[2] }),
    to: hexIndex({ hex: read[3] }),
    asset: USDC_ASSET,
    fromRoute: COLLATERAL_ROUTE,
    toRoute: COLLATERAL_ROUTE,
    amount: BigInt(`0x${read[4] ?? ""}`),
    fee: BigInt(`0x${read[5] ?? ""}`),
    memo: fromHex(read[6] ?? ""),
    expiredAt: 0,
    nonce: hexIndex({ hex: read[1] }),
    apiKey,
  }
  if (transferMessage(transfer) !== message) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  if (transfer.fee > BigInt(LIGHTER_MAX_TRANSFER_FEE)) {
    refuse({ refusal: SignableRefusal.FEE_OVER_CAP })
  }
  return { transfer, memo: read[6] ?? "" }
}

/**
 * Lighter: Main's fast withdrawal straight into a venue's deposit address for Main, by Lighter's owner message for the
 * transfer to Lighter's pool that Main's transfer key sends: a venue measured to credit Lighter's pool contract only,
 * Bybit; to the pinned pool account only; from Main's own Lighter account, as the browser read it from Lighter; at least
 * Lighter's least; and its memo, the address the pool pays, the one the browser took once Main's own signature of it
 * recovered Main, then 12 zero bytes. The request's word for the address is never taken.
 */
function lighterFastWithdrawal({ message, user, lighterAccounts, depositVenue, depositAddress }: DepositMessageRuleProps): SignSummary {
  const action = LIGHTER_FAST_ACTIONS[depositVenue] ?? refuse({ refusal: SignableRefusal.DEPOSIT_VENUE })
  const read = lighterTransferRead({ message })
  const transfer = read.transfer
  if (transfer.to !== LIGHTER_FAST_WITHDRAW_POOL_INDEX) {
    refuse({ refusal: SignableRefusal.NOT_FAST_WITHDRAW_POOL })
  }
  if (transfer.amount < LIGHTER_FAST_MIN_UNITS) {
    refuse({ refusal: SignableRefusal.DEPOSIT_TOO_SMALL })
  }
  const from = lighterAccounts?.get(transfer.from) ?? refuse({ refusal: SignableRefusal.LIGHTER_ACCOUNTS_UNREAD })
  if (!isAddress({ address: from, other: user.address })) {
    refuse({ refusal: SignableRefusal.NOT_FROM_MAIN_LIGHTER })
  }
  if (depositAddress === undefined || depositAddress.venue !== depositVenue) {
    return refuse({ refusal: SignableRefusal.DEPOSIT_UNREAD })
  }
  if (read.memo !== `${depositAddress.address.slice(2).toLowerCase()}${LIGHTER_FAST_WITHDRAW_MEMO_PADDING}`) {
    refuse({ refusal: SignableRefusal.NOT_DEPOSIT_ADDRESS })
  }
  return {
    action,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: `${formatUnits(transfer.amount, LIGHTER_USDC_DECIMALS)} ${USDC}` },
      { label: SignSummaryLabel.LIGHTER_FEE, value: `${formatUnits(transfer.fee, LIGHTER_USDC_DECIMALS)} ${USDC}` },
      { label: SignSummaryLabel.DEPOSIT_ADDRESS, value: shortAddress({ address: depositAddress.address }) },
      { label: SignSummaryLabel.LIGHTER_POOL, value: String(transfer.to) },
    ],
    chainId: null,
  }
}

/**
 * Lighter: Main's transfer to one of the user's own sub-accounts, or one shared with them, by Lighter's owner message
 * for the transfer Main's transfer key sends. Only that message as Lighter writes it, read field by field and written
 * again the same: one of lebroker's keys on Main, 200 to 252, USDC between collateral routes, on Lighter's chain,
 * within the fee Lighter ever charges. Lighter names its accounts by index alone: each is the one the signing side
 * read from Lighter itself (`lighterAccounts`), from Main's own account to the open sub-account funds go to.
 */
function lighterTransfer({ message, user, accounts, lighterAccounts }: MessageRuleProps): SignSummary {
  const transfer = lighterTransferRead({ message }).transfer
  const from = lighterAccounts?.get(transfer.from) ?? refuse({ refusal: SignableRefusal.LIGHTER_ACCOUNTS_UNREAD })
  if (!isAddress({ address: from, other: user.address })) {
    refuse({ refusal: SignableRefusal.NOT_FROM_MAIN_LIGHTER })
  }
  const to = recipientSubAccount({
    address: lighterAccounts?.get(transfer.to) ?? refuse({ refusal: SignableRefusal.LIGHTER_ACCOUNTS_UNREAD }),
    accounts,
  })
  return {
    action: SignSummaryText.TRANSFER,
    lines: [
      { label: SignSummaryLabel.AMOUNT, value: `${formatUnits(transfer.amount, LIGHTER_USDC_DECIMALS)} ${USDC}` },
      { label: SignSummaryLabel.LIGHTER_FEE, value: `${formatUnits(transfer.fee, LIGHTER_USDC_DECIMALS)} ${USDC}` },
      { label: SignSummaryLabel.TO, value: toAccount({ account: to }) },
    ],
    chainId: null,
  }
}

export {
  asterTransfer,
  asterWithdrawal,
  hyperliquidChain,
  hyperliquidCctpDeposit,
  hyperliquidDepositWithdrawal,
  hyperliquidTransfer,
  hyperliquidWithdrawal,
  lighterFastWithdrawal,
  lighterTransfer,
  polymarketBridgeDeposit,
  polymarketPerpsToWallet,
}
