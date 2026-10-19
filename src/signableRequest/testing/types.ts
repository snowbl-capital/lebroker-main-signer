import type { LaMargeTake, SignaturePayloadKind, SignatureRequestKind, SignatureRequestReason } from "../../lebroker/accounts/model"
import type { SignableRequestProps } from "../types"

/** Typed data of any shape, bigints and all, as a venue's builder makes it. */
type WireProps = { typedData: unknown }

type RequestOfProps = {
  kind?: SignatureRequestKind
  venue?: string | null
  /** The typed data asked; ignored when `message` is given. */
  typedData?: unknown
  /** A personal message asked, in place of typed data. */
  message?: string
  accountId?: string
  walletChainId?: number | null
  reason?: SignatureRequestReason
  /** The LaMarge take the request names, beside its typed data. */
  take?: LaMargeTake
  /** When it was asked, in ms. */
  askedAt?: number
  /** Main's address, the signed-in user's. */
  main?: string
}

/** Typed data as a request's payload carries it. */
type WiredTypedData = Extract<SignableRequestProps["request"]["payload"], { kind: SignaturePayloadKind.TYPED_DATA }>["typedData"]

type RegistrationMessageProps = { accountIndex: number; apiKeyIndex: number }

export type { RegistrationMessageProps, RequestOfProps, WiredTypedData, WireProps }
