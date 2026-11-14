// The typed data lebroker's service asks Main to sign, built as `@lebroker/venues/model`'s builders build it, from the
// same domains and types: what the allowlist's tests check it against. Tests only.
import {
  ASTER_APPROVAL_CHAIN_ID,
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_DOMAIN,
  AsterAgentKind,
  HYPERLIQUID_APPROVE_AGENT_TYPES,
  HYPERLIQUID_CCTP_SEND,
  HYPERLIQUID_CHAINS,
  HYPERLIQUID_SEND_ASSET_TYPES,
  HYPERLIQUID_SEND_TO_EVM_TYPES,
  HYPERLIQUID_USER_SIGNED_DOMAIN,
  HYPERLIQUID_VALID_UNTIL,
  HYPERLIQUID_WITHDRAW_TYPES,
  POLYMARKET_CREATE_PROXY_TYPES,
  POLYMARKET_SIGN_DOMAIN,
  asterAgentNames,
} from "../../../lebroker/venues/model"
import { AGENT_NAME as ASTER_AGENT_NAME } from "../../../lebroker/venues/aster/constants"
import { WIRE_DECIMALS } from "./constants"
import type {
  AgentApprovalRequestProps,
  ApproveAgentRequestProps,
  CctpSendRequestProps,
  CreateProxyTypedDataProps,
  SendAssetRequestProps,
  ToWireProps,
  UserSignedTypedDataProps,
  WithdrawRequestProps,
} from "./types"

function toWire({ value }: ToWireProps): string {
  const fixed = value.toFixed(WIRE_DECIMALS).replace(/\.?0+$/, "")
  return fixed === "-0" ? "0" : fixed
}

function userSigned({
  fields,
  types,
  primaryType,
  network,
  signatureChainId = HYPERLIQUID_USER_SIGNED_DOMAIN.chainId,
}: UserSignedTypedDataProps) {
  const hyperliquidChain = HYPERLIQUID_CHAINS[network]
  return {
    typedData: {
      domain: { ...HYPERLIQUID_USER_SIGNED_DOMAIN, chainId: signatureChainId },
      types,
      primaryType,
      message: { hyperliquidChain, ...fields },
    },
  }
}

function hyperliquidApproveAgentRequest({ agentAddress, name, validUntil, nonce, network, signatureChainId }: ApproveAgentRequestProps) {
  return userSigned({
    fields: { agentAddress, agentName: `${name} ${HYPERLIQUID_VALID_UNTIL} ${validUntil}`, nonce },
    types: HYPERLIQUID_APPROVE_AGENT_TYPES,
    primaryType: "HyperliquidTransaction:ApproveAgent",
    network,
    ...(signatureChainId === undefined ? {} : { signatureChainId }),
  })
}

function hyperliquidSendAssetRequest({
  destination,
  sourceDex,
  destinationDex,
  token,
  amount,
  nonce,
  network,
  signatureChainId,
}: SendAssetRequestProps) {
  return userSigned({
    fields: { destination, sourceDex, destinationDex, token, amount: toWire({ value: amount }), fromSubAccount: "", nonce },
    types: HYPERLIQUID_SEND_ASSET_TYPES,
    primaryType: "HyperliquidTransaction:SendAsset",
    network,
    ...(signatureChainId === undefined ? {} : { signatureChainId }),
  })
}

function hyperliquidWithdrawRequest({ destination, amount, time, network, signatureChainId }: WithdrawRequestProps) {
  return userSigned({
    fields: { destination, amount: toWire({ value: amount }), time },
    types: HYPERLIQUID_WITHDRAW_TYPES,
    primaryType: "HyperliquidTransaction:Withdraw",
    network,
    ...(signatureChainId === undefined ? {} : { signatureChainId }),
  })
}

/**
 * Hyperliquid's `sendToEvmWithData` of USDC from spot through Circle's CCTP to an address on an EVM chain, named by its
 * CCTP domain: Main's send straight into a venue's deposit address. Its nonce is its time.
 */
function hyperliquidCctpSendRequest({ destination, amount, domain, nonce, network, signatureChainId }: CctpSendRequestProps) {
  return userSigned({
    fields: {
      token: HYPERLIQUID_CCTP_SEND.token,
      amount: toWire({ value: amount }),
      sourceDex: HYPERLIQUID_CCTP_SEND.sourceDex,
      destinationRecipient: destination.toLowerCase(),
      addressEncoding: HYPERLIQUID_CCTP_SEND.addressEncoding,
      destinationChainId: domain,
      gasLimit: HYPERLIQUID_CCTP_SEND.gasLimit,
      data: HYPERLIQUID_CCTP_SEND.data,
      nonce,
    },
    types: HYPERLIQUID_SEND_TO_EVM_TYPES,
    primaryType: "HyperliquidTransaction:SendToEvmWithData",
    network,
    ...(signatureChainId === undefined ? {} : { signatureChainId }),
  })
}

/**
 * An Aster agent's approval, its query in the order Aster signs it, on Aster's approval chain: the trading agent trades
 * perps, the conversion agent Spot, the withdrawal agent only withdraws. Each is named after the deployment's trading
 * agent, `agentName`, production's by default.
 */
function asterAgentApprovalRequest({ kind, user, agent, nonce, expiry, agentName = ASTER_AGENT_NAME }: AgentApprovalRequestProps) {
  const query = new URLSearchParams({
    user,
    nonce,
    agentName: asterAgentNames({ name: agentName })[kind],
    agentAddress: agent,
    expired: String(expiry),
    signatureChainId: String(ASTER_APPROVAL_CHAIN_ID),
    canSpotTrade: String(kind === AsterAgentKind.CONVERT),
    canPerpTrade: String(kind === AsterAgentKind.TRADING),
    canWithdraw: String(kind === AsterAgentKind.WITHDRAWAL),
  }).toString()
  return {
    query,
    typedData: {
      domain: { ...ASTER_SIGN_DOMAIN, chainId: ASTER_APPROVAL_CHAIN_ID },
      types: ASTER_MESSAGE_TYPES,
      primaryType: "Message" as const,
      message: { msg: query },
    },
  }
}

function polymarketCreateProxyTypedData({ proxy, expiry, salt, ts }: CreateProxyTypedDataProps) {
  return {
    domain: POLYMARKET_SIGN_DOMAIN,
    types: POLYMARKET_CREATE_PROXY_TYPES,
    primaryType: "CreateProxy" as const,
    message: { addr: proxy, exp: BigInt(expiry), salt: BigInt(salt), ts: BigInt(ts) },
  }
}

export {
  asterAgentApprovalRequest,
  hyperliquidApproveAgentRequest,
  hyperliquidCctpSendRequest,
  hyperliquidSendAssetRequest,
  hyperliquidWithdrawRequest,
  polymarketCreateProxyTypedData,
}
