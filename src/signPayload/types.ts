import type { LocalAccount } from "viem"
import type { SignaturePayload } from "../lebroker/accounts/model"

/** `chainId`: the one chain the allowlist lets typed data be signed on; null for a personal message. */
type SignPayloadProps = { account: LocalAccount; payload: SignaturePayload; chainId: number | null }

export type { SignPayloadProps }
