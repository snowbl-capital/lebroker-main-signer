import type { Address } from "viem"
import type { Network } from "../../../lebroker/core/model"
import type { AsterAgentKind } from "./enums"

/** The chain Main's wallet signs a Hyperliquid user action on: Hyperliquid's own tools' when none is named. */
type SignatureChainProps = { signatureChainId?: number }

type ApproveAgentRequestProps = {
  agentAddress: Address
  name: string
  validUntil: number
  nonce: number
  network: Network
} & SignatureChainProps

type SendAssetRequestProps = {
  destination: Address
  sourceDex: string
  destinationDex: string
  token: string
  amount: number
  nonce: number
  network: Network
} & SignatureChainProps

type WithdrawRequestProps = { destination: Address; amount: number; time: number; network: Network } & SignatureChainProps

type UserSignedTypedDataProps = {
  fields: Record<string, unknown>
  types: Record<string, readonly { name: string; type: string }[]>
  primaryType: string
  network: Network
} & SignatureChainProps

type ToWireProps = { value: number }

type AgentApprovalRequestProps = {
  kind: AsterAgentKind
  user: string
  agent: string
  nonce: string
  /** In milliseconds. */
  expiry: number
  now: number
}

type CreateProxyTypedDataProps = { proxy: Address; expiry: number; salt: number; ts: number }

export type {
  AgentApprovalRequestProps,
  ApproveAgentRequestProps,
  CreateProxyTypedDataProps,
  SendAssetRequestProps,
  ToWireProps,
  UserSignedTypedDataProps,
  WithdrawRequestProps,
}
