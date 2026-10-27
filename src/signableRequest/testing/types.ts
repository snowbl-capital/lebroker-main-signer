import type {
  GasPurchaseContext,
  LaMargeRequestContext,
  LaMargeSend,
  LaMargeTake,
  SignaturePayloadKind,
  SignatureRequestKind,
  SignatureRequestReason,
} from "../../lebroker/accounts/model"
import type { VenueId } from "../../lebroker/core/model"
import type { Address } from "viem"
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
  /** A LaMarge send's terms, beside its typed data; none by default. */
  send?: LaMargeSend
  /** What a payment to the gas reserve says it buys, beside its typed data; none by default. */
  gas?: GasPurchaseContext | null
  /** The venue a withdrawal says it pays straight for Main, beside its typed data; none by default. */
  depositVenue?: VenueId | null
  /** That venue's address for Main, as the signing side read it from the venue; none read by default. */
  depositAddress?: ReadDepositAddress
  /** The recipients Main's address book approves, as the Main signer reads it; none read, as in the browser, by default. */
  approvedRecipients?: readonly string[]
  /** The origin of the deployment the request is signed on: lebroker's live one by default, whose gas reserve is pinned. */
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

/** A Hyperliquid transfer from Main to `destination`, the sub-account by default, read with these approved recipients. */
type TransferToProps = { approvedRecipients?: readonly string[]; destination?: Address }

export type { RegistrationMessageProps, RequestOfProps, TransferToProps, WiredTypedData, WireProps }
