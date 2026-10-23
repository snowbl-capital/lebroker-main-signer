import type {
  GasPurchaseContext,
  LaMargeRequestContext,
  LaMargeTake,
  SignaturePayloadKind,
  SignatureRequestKind,
  SignatureRequestReason,
} from "../../lebroker/accounts/model"
import type { VenueId } from "../../lebroker/core/model"
import type { ReadDepositAddress, SignableRequestProps } from "../types"

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
  /** The LaMarge take the request names, beside its typed data or its message. */
  take?: LaMargeTake
  /** The LaMarge deployment the request says it's for: production's by default, none when null. */
  lamarge?: LaMargeRequestContext | null
  /** What a payment to the gas reserve says it buys, beside its typed data; none by default. */
  gas?: GasPurchaseContext | null
  /** The venue a withdrawal says it pays straight for Main, beside its typed data; none by default. */
  depositVenue?: VenueId | null
  /** That venue's address for Main, as the signing side read it from the venue; none read by default. */
  depositAddress?: ReadDepositAddress
  /** The origin of the deployment the request is signed on: lebroker's dev by default, whose gas reserve is pinned. */
  appOrigin?: string
  /** When it was asked, in ms. */
  askedAt?: number
  /** When it's read, in ms: when it was asked, unless said. */
  now?: number
  /** Main's address, the signed-in user's. */
  main?: string
}

/** Typed data as a request's payload carries it. */
type WiredTypedData = Extract<SignableRequestProps["request"]["payload"], { kind: SignaturePayloadKind.TYPED_DATA }>["typedData"]

type RegistrationMessageProps = { accountIndex: number; apiKeyIndex: number }

export type { RegistrationMessageProps, RequestOfProps, WiredTypedData, WireProps }
