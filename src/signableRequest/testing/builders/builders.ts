// The typed data lebroker's service asks Main to sign, built as `@lebroker/venues/model`'s builders build it, from the
// same domains and types: what the allowlist's tests check it against. Tests only.
import {
  ASTER_AGENT_NAME,
  ASTER_APPROVAL_CHAIN_ID,
  ASTER_MESSAGE_TYPES,
  ASTER_SIGN_DOMAIN,
  HYPERLIQUID_APPROVE_AGENT_TYPES,
  HYPERLIQUID_CHAINS,
  HYPERLIQUID_SEND_ASSET_TYPES,
  HYPERLIQUID_USER_SIGNED_DOMAIN,
  HYPERLIQUID_VALID_UNTIL,
  HYPERLIQUID_WITHDRAW_TYPES,
  POLYMARKET_CREATE_PROXY_TYPES,
  POLYMARKET_SIGN_DOMAIN,
} from "../../../lebroker/venues/model"
import { ASTER_WITHDRAWAL_AGENT_NAME, WIRE_DECIMALS } from "./constants"
import { AsterAgentKind } from "./enums"
import type {
  AgentApprovalRequestProps,
  ApproveAgentRequestProps,
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

/** An Aster agent's approval, its query in the order Aster signs it, on Aster's approval chain. */
function asterAgentApprovalRequest({ kind, user, agent, nonce, expiry }: AgentApprovalRequestProps) {
  const withdrawal = kind === AsterAgentKind.WITHDRAWAL
  const query = new URLSearchParams({
    user,
    nonce,
    agentName: withdrawal ? ASTER_WITHDRAWAL_AGENT_NAME : ASTER_AGENT_NAME,
    agentAddress: agent,
    expired: String(expiry),
    signatureChainId: String(ASTER_APPROVAL_CHAIN_ID),
    canSpotTrade: "false",
    canPerpTrade: String(!withdrawal),
    canWithdraw: String(withdrawal),
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
  hyperliquidSendAssetRequest,
  hyperliquidWithdrawRequest,
  polymarketCreateProxyTypedData,
}
