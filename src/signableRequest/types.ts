import type { Typed } from "@lamarge/sdk/protocol"
import type { LaMargeRequestContext, LaMargeTake, SignatureRequestReason, TypedDataPayload } from "../lebroker/accounts/model"
import type { SignatureRequestView } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { AccountView, SessionUser } from "../lebroker/web/types"
import type { SignableRefusal } from "./enums"

type SignableAccount = Pick<AccountView, "id" | "name" | "kind" | "state" | "address">

type SignableRequestProps = {
  request: Pick<SignatureRequestView, "kind" | "reason" | "venue" | "accountId" | "createdAt" | "payload">
  /** Main: the signed-in user, whose wallet signs. */
  user: Pick<SessionUser, "id" | "address">
  /** The user's own accounts, as the service lists them: where a transfer may send funds. */
  accounts: readonly SignableAccount[]
  /** The chain the wallet shows; null when it says none. */
  walletChainId: number | null
  /** When it's read, in ms: now, unless said. */
  now?: number
}

type SummaryLine = { label: string; value: string }

/**
 * What Main signs, decoded from the request itself and never from the service's words: what it does, its terms, and
 * the one chain it's signed on, which the wallet may be switched to; null for a message signed on any chain.
 */
type SignSummary = { action: string; lines: SummaryLine[]; chainId: number | null }

/** A request the browser signs, with its summary, or refuses, with why. */
type Signable = { ok: true; summary: SignSummary } | { ok: false; refusal: string }

/** Its words: a refusal of the browser's, or LaMarge's check's after it. */
type NotSignableProps = { refusal: string }

/**
 * What every rule reads: the request, Main, the user's accounts, the wallet's chain, when it was asked and when it's
 * read, in ms. `askedAt` bounds what lebroker asks for a fixed time after it asks; `now` checks the windows the
 * request's contents name, which may close before the request leaves the banner.
 */
type RuleProps = Omit<SignableRequestProps, "now"> & { askedAt: number; now: number }

type TypedRuleProps = RuleProps & { typedData: TypedDataPayload }

type MessageRuleProps = RuleProps & { message: string }

type ExpectedDomainProps = { typedData: TypedDataPayload; domain: Readonly<Record<string, unknown>> }

type ExpectedTypesProps = {
  typedData: TypedDataPayload
  types: Readonly<Record<string, readonly { name: string; type: string }[]>>
  primaryType: string
}

type QueryFieldsProps = { query: string; names: readonly string[] }

type OwnAccountProps = { address: unknown; accounts: readonly SignableAccount[] }

type SameAddressProps = { address: unknown; other: string }

type ChainOfProps = { typedData: TypedDataPayload }

type AllowedChainProps = { chainId: number; allowed: readonly (number | null)[] }

type UntilProps = { ms: number }

type AtMostProps = { value: number; max: number }

type RefuseProps = { refusal: SignableRefusal | string }

type SameDomainValueProps = { value: unknown; expected: unknown }

type ValueProps = { value: unknown }

type DelegateProps = { address: unknown; main: string }

type AmountProps = { value: unknown; symbol: string }

type ToAccountProps = { account: SignableAccount }

/** Typed data for a LaMarge move, and the take its request names, null for none: what a take's payment is checked against. */
type LaMargeTypedRuleProps = TypedRuleProps & { take: LaMargeTake | null; lamarge: LaMargeRequestContext | null }

/** A message for a LaMarge move, and the take its request names, null for none. */
type LaMargeMessageRuleProps = MessageRuleProps & { take: LaMargeTake | null; lamarge: LaMargeRequestContext | null }

/** A LaMarge deployment Main signs for: its app's origin, and the name its Aster agent goes by. */
type LaMargeDeploymentPins = { appOrigin: string; asterAgentName: string }

/** The LaMarge deployment a request says it's for, null when it says none. */
type DeploymentOfProps = { lamarge: LaMargeRequestContext | null }

/** Lighter's owner message for a transfer, as `LIGHTER_TRANSFER_MESSAGE` read it. */
type LighterTakeProps = LaMargeMessageRuleProps & { read: RegExpExecArray }

/** A field of a Lighter message, written in hex: an index or a nonce. */
type HexIndexProps = { hex: string | undefined }

/** Typed data for a LaMarge move, as its SDK checks it. */
type LaMargeTypedProps = LaMargeTypedRuleProps & { typed: Typed }

type VenueOfProps = { typed: Typed }

/** Why the request is asked, as it says it. */
type StartedByProps = { reason: SignatureRequestReason }

/** An amount in a LaMarge venue's token's base units. */
type UnitsProps = { value: bigint; venue: string }

/** A check of LaMarge's SDK, which throws its own words: they become the refusal's. */
type LaMargeCheckProps<T> = { check: () => T }

export type {
  DeploymentOfProps,
  LaMargeDeploymentPins,
  AllowedChainProps,
  AmountProps,
  AtMostProps,
  ChainOfProps,
  DelegateProps,
  ExpectedDomainProps,
  ExpectedTypesProps,
  HexIndexProps,
  LaMargeCheckProps,
  LaMargeMessageRuleProps,
  LaMargeTypedProps,
  LaMargeTypedRuleProps,
  LighterTakeProps,
  MessageRuleProps,
  NotSignableProps,
  OwnAccountProps,
  QueryFieldsProps,
  RefuseProps,
  RuleProps,
  SameAddressProps,
  SameDomainValueProps,
  Signable,
  SignableAccount,
  SignableRequestProps,
  SignSummary,
  StartedByProps,
  SummaryLine,
  ToAccountProps,
  TypedRuleProps,
  UnitsProps,
  UntilProps,
  ValueProps,
  VenueOfProps,
}
