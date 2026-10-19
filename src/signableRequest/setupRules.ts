import { isLighterKeyIndex } from "../lebroker/accounts/model"
import { shortAddress } from "../lebroker/core/model"
import {
  AsterBoolean,
  LIGHTER_REGISTRATION_MESSAGE,
  MAIN_LIGHTER_ACCOUNT_PROOF_TYPES,
  MAX_PROOF_LIFETIME_MS,
  SUB_ACCOUNT_PROOF_DOMAIN,
} from "../lebroker/signer/model"
import {
  ASTER_AGENT_NAME,
  ASTER_AGENT_TTL_MS,
  ASTER_APPROVAL_CHAIN_ID,
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_DOMAIN,
  HYPERLIQUID_AGENT_MAX_VALIDITY_MS,
  HYPERLIQUID_AGENT_NAME,
  HYPERLIQUID_APPROVE_AGENT_TYPES,
  HYPERLIQUID_USER_SIGNED_DOMAIN,
  HYPERLIQUID_VALID_UNTIL,
  POLYMARKET_CREATE_PROXY_TYPES,
  POLYMARKET_PROXY_TTL_MS,
  POLYMARKET_SIGN_DOMAIN,
} from "../lebroker/venues/model"
import { ASTER_APPROVAL_FIELDS, CLOCK_SLACK_MS, HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID, HYPERLIQUID_MAINNET } from "./constants"
import { SignableRefusal, SignSummaryLabel, SignSummaryText } from "./enums"
import type { DelegateProps, MessageRuleProps, SignSummary, TypedRuleProps } from "./types"
import { allowedChain, atMost, chainOf, expectDomain, expectTypes, isAddress, queryFields, refuse, text, until, wholeNumber } from "./utils"

/** An agent or proxy lebroker's signer made: an address, never Main's own. */
function delegate({ address, main }: DelegateProps): string {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address) || isAddress({ address, other: main })) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return address
}

/**
 * Hyperliquid: Main approves lebroker's named agent for 180 days at most, on the chain its wallet shows or Hyperliquid's
 * own, Arbitrum (D2, D38).
 */
function hyperliquidApproval({ typedData, user, walletChainId, askedAt }: TypedRuleProps): SignSummary {
  const chainId = allowedChain({ chainId: chainOf({ typedData }), allowed: [walletChainId, HYPERLIQUID_DEFAULT_SIGNATURE_CHAIN_ID] })
  expectDomain({ typedData, domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId } })
  expectTypes({ typedData, types: HYPERLIQUID_APPROVE_AGENT_TYPES, primaryType: "HyperliquidTransaction:ApproveAgent" })
  if (typedData.message.hyperliquidChain !== HYPERLIQUID_MAINNET) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  const prefix = `${HYPERLIQUID_AGENT_NAME} ${HYPERLIQUID_VALID_UNTIL} `
  const agentName = text({ value: typedData.message.agentName })
  const end = agentName.startsWith(prefix) ? agentName.slice(prefix.length) : ""
  const validUntil = /^\d{1,16}$/.test(end) ? Number(end) : refuse({ refusal: SignableRefusal.NOT_LEBROKER_AGENT })
  atMost({ value: validUntil - wholeNumber({ value: typedData.message.nonce }), max: HYPERLIQUID_AGENT_MAX_VALIDITY_MS })
  atMost({ value: validUntil, max: askedAt + HYPERLIQUID_AGENT_MAX_VALIDITY_MS + CLOCK_SLACK_MS })
  const agent = delegate({ address: typedData.message.agentAddress, main: user.address })
  return {
    action: SignSummaryText.APPROVE_HYPERLIQUID_AGENT,
    lines: [
      { label: SignSummaryLabel.AGENT, value: shortAddress({ address: agent }) },
      { label: SignSummaryLabel.VALID_UNTIL, value: until({ ms: validUntil }) },
      { label: SignSummaryLabel.CHAIN, value: String(chainId) },
    ],
    chainId,
  }
}

/** Aster: Main approves lebroker's agent to trade perps, never Spot, never to withdraw, for 180 days at most (D2). */
function asterApproval({ typedData, user, askedAt }: TypedRuleProps): SignSummary {
  expectDomain({ typedData, domain: { ...ASTER_SIGN_DOMAIN, chainId: ASTER_APPROVAL_CHAIN_ID } })
  expectTypes({ typedData, types: ASTER_MESSAGE_TYPES, primaryType: "Message" })
  const fields = queryFields({ query: text({ value: typedData.message.msg }), names: ASTER_APPROVAL_FIELDS })
  if (!isAddress({ address: fields.user, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (fields.agentName !== ASTER_AGENT_NAME) {
    refuse({ refusal: SignableRefusal.NOT_LEBROKER_AGENT })
  }
  if (
    fields.canWithdraw !== AsterBoolean.FALSE ||
    fields.canSpotTrade !== AsterBoolean.FALSE ||
    fields.canPerpTrade !== AsterBoolean.TRUE
  ) {
    refuse({ refusal: SignableRefusal.WITHDRAW_PERMISSION })
  }
  if (fields.signatureChainId !== String(ASTER_APPROVAL_CHAIN_ID)) {
    refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
  }
  const expiry = wholeNumber({ value: fields.expired })
  atMost({ value: expiry, max: askedAt + ASTER_AGENT_TTL_MS + CLOCK_SLACK_MS })
  const agent = delegate({ address: fields.agentAddress, main: user.address })
  return {
    action: SignSummaryText.APPROVE_ASTER_AGENT,
    lines: [
      { label: SignSummaryLabel.AGENT, value: shortAddress({ address: agent }) },
      { label: SignSummaryLabel.VALID_UNTIL, value: until({ ms: expiry }) },
    ],
    chainId: ASTER_APPROVAL_CHAIN_ID,
  }
}

/** Polymarket Perps: Main approves lebroker's proxy for a week at most (D2, D14). */
function polymarketApproval({ typedData, user, askedAt }: TypedRuleProps): SignSummary {
  expectDomain({ typedData, domain: POLYMARKET_SIGN_DOMAIN })
  expectTypes({ typedData, types: POLYMARKET_CREATE_PROXY_TYPES, primaryType: "CreateProxy" })
  const expiry = wholeNumber({ value: typedData.message.exp })
  atMost({ value: expiry, max: askedAt + POLYMARKET_PROXY_TTL_MS + CLOCK_SLACK_MS })
  const proxy = delegate({ address: typedData.message.addr, main: user.address })
  return {
    action: SignSummaryText.APPROVE_POLYMARKET_PROXY,
    lines: [
      { label: SignSummaryLabel.PROXY, value: shortAddress({ address: proxy }) },
      { label: SignSummaryLabel.VALID_UNTIL, value: until({ ms: expiry }) },
    ],
    chainId: POLYMARKET_SIGN_DOMAIN.chainId,
  }
}

/** Lighter, first: Main proves the Lighter account is its own, for its own account, a day at most (D6). */
function lighterProof({ typedData, user, request, askedAt }: TypedRuleProps): SignSummary {
  expectDomain({ typedData, domain: SUB_ACCOUNT_PROOF_DOMAIN })
  expectTypes({ typedData, types: MAIN_LIGHTER_ACCOUNT_PROOF_TYPES, primaryType: "MainLighterAccount" })
  if (typedData.message.owner !== user.id || !isAddress({ address: typedData.message.main, other: user.address })) {
    refuse({ refusal: SignableRefusal.OTHER_MAIN })
  }
  if (typedData.message.account !== request.accountId) {
    refuse({ refusal: SignableRefusal.OTHER_ACCOUNT })
  }
  atMost({ value: wholeNumber({ value: typedData.message.deadline }) * 1000, max: askedAt + MAX_PROOF_LIFETIME_MS + CLOCK_SLACK_MS })
  return {
    action: SignSummaryText.PROVE_LIGHTER_ACCOUNT,
    lines: [{ label: SignSummaryLabel.ACCOUNT_INDEX, value: String(wholeNumber({ value: typedData.message.accountIndex })) }],
    chainId: SUB_ACCOUNT_PROOF_DOMAIN.chainId,
  }
}

/** Lighter, then: Main signs the registration of lebroker's key, at one of its own indexes only, 200 to 253 (D6). */
function lighterRegistration({ message }: MessageRuleProps): SignSummary {
  const read = LIGHTER_REGISTRATION_MESSAGE.exec(message) ?? refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  const apiKeyIndex = Number.parseInt(read[3] ?? "", 16)
  if (!isLighterKeyIndex({ apiKeyIndex })) {
    refuse({ refusal: SignableRefusal.NOT_LEBROKER_KEY })
  }
  return {
    action: SignSummaryText.REGISTER_LIGHTER_KEY,
    lines: [
      { label: SignSummaryLabel.ACCOUNT_INDEX, value: String(Number.parseInt(read[2] ?? "", 16)) },
      { label: SignSummaryLabel.KEY_INDEX, value: String(apiKeyIndex) },
    ],
    chainId: null,
  }
}

export { asterApproval, hyperliquidApproval, lighterProof, lighterRegistration, polymarketApproval }
