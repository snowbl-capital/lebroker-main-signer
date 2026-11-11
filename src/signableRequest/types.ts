import type { Attested, Environment } from "@lamarge/sdk/attestation"
import type { Typed } from "@lamarge/sdk/protocol"
import type {
  GmxSubaccountApprovalFacts,
  GmxUsdcPermitFacts,
  KeyDeletion,
  LaMargeOp,
  LaMargeRequestContext,
  LaMargeSend,
  LaMargeTake,
  SignatureRequestReason,
  SignatureStep,
  TypedDataPayload,
} from "../lebroker/accounts/model"
import type { VenueId } from "../lebroker/core/model"
import type { AsterAgentKind } from "../lebroker/venues/model"
import type { SignatureRequestView } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { AccountView, SessionUser, SharedAccountView } from "../lebroker/web/types"
import type { SignableRefusal, SignSummaryText } from "./enums"

type SignableAccount = Pick<AccountView, "id" | "name" | "kind" | "state" | "address">

/** A sub-account another user shares with the user, with its owner's address: it's named with it where funds go to it. */
type SharedSignableAccount = SignableAccount & Pick<SharedAccountView, "ownerAddress">

/**
 * An account funds from Main may go to, as the rules read it: one of the user's own, or a sub-account shared with them
 * named with its owner. `approved`: whether funds from Main may go to it, every account in the browser, only those
 * Main's own address book names where the signing side reads it.
 */
type RuleAccount = SignableAccount & { approved: boolean }

type SignableRequestProps = {
  request: Pick<SignatureRequestView, "kind" | "reason" | "venue" | "accountId" | "createdAt" | "payload">
  /** Main: the signed-in user, whose wallet signs. */
  user: Pick<SessionUser, "id" | "address">
  /** The user's own accounts, as the service lists them: where a transfer may send funds. */
  accounts: readonly SignableAccount[]
  /**
   * The sub-accounts other users share with the user, as the service lists them beside their own: where a transfer
   * from Main may send funds too, inside a venue, each named with its owner. A grant is its grantor's word alone, so
   * where the signing side reads Main's address book, funds go to one only once an entry of Main's own approves it,
   * as to the user's own sub-accounts. None by default.
   */
  shared?: readonly SharedSignableAccount[] | undefined
  /** The chain the wallet shows; null when it says none. */
  walletChainId: number | null
  /**
   * lebroker's agent's name on Hyperliquid in this deployment, from its settings: an approval under any other would
   * replace another deployment's agent, or another app's.
   */
  hyperliquidAgentName: string
  /**
   * lebroker's trading agent's name on Aster in this deployment, from its settings, its conversion agent's made from it:
   * an approval under any other would replace another deployment's agent, or another app's.
   */
  asterAgentName: string
  /**
   * For Main's withdrawal straight into a venue's deposit address for Main, that address as the signing side read
   * it itself from the venue the request names, for Main's own address, just before it signs: never the request's word.
   * Absent where none was read, and such a withdrawal is refused.
   */
  depositAddress?: ReadDepositAddress | undefined
  /**
   * For Main's Lighter transfer, the L1 address of each Lighter account its message names, by index, read by the signing
   * side itself from Lighter just before it signs, never from lebroker; absent where it isn't read: nothing is signed.
   */
  lighterAccounts?: ReadonlyMap<number, string> | undefined
  /**
   * The recipients Main's own key approves now in its address book, each entry's signature checked by the signing
   * side itself against Main's own address and its own deployment, the latest entry naming an address holding, never
   * the service's word: funds from Main to another of the user's accounts go to one of them only. Absent in the
   * browser, where the wallet's own prompt is the user's check.
   */
  approvedRecipients?: readonly string[] | undefined
  /**
   * LaMarge's attestation of the request, as the signing side verified it itself against the pinned attester of the
   * deployment the request is for (`verifyAttestation`), never the service's word: a take's terms are held to it.
   * Absent where the request carries none.
   */
  attested?: Attested | undefined
  /** When it's read, in ms: now, unless said. */
  now?: number
}

/**
 * A venue's deposit address for Main's own address, as the signing side read it from the venue. `payTo`: for a
 * withdrawal through Polymarket's bridge, the address the bridge answered the signing side itself, for Main's own Deposit
 * Wallet, as paying that deposit address; absent otherwise.
 */
type ReadDepositAddress = { venue: VenueId; address: string; payTo?: string }

type SummaryLine = { label: string; value: string }

/**
 * What Main signs, decoded from the request itself and never from the service's words: what it does, its terms, and
 * the one chain it's signed on, which the wallet may be switched to; null for a message signed on any chain.
 */
type SignSummary = { action: string; lines: SummaryLine[]; chainId: number | null }

/** A request's summary, and its place in a chain of signatures where the request is one of them. */
type SteppedProps = { summary: SignSummary; step: SignatureStep | undefined }

/** A request the browser signs, with its summary, or refuses, with why. */
type Signable = { ok: true; summary: SignSummary } | { ok: false; refusal: string }

/** Its words: a refusal of the browser's, or LaMarge's check's after it. */
type NotSignableProps = { refusal: string }

/**
 * What every rule reads: the request, Main, the user's accounts with whether funds may go to each, the wallet's chain,
 * when it was asked and when it's read, in ms. `askedAt` bounds what lebroker asks for a fixed time after it asks;
 * `now` checks the windows the request's contents name, which may close before the request leaves the banner.
 */
type RuleProps = Omit<SignableRequestProps, "now" | "accounts"> & { accounts: readonly RuleAccount[]; askedAt: number; now: number }

type TypedRuleProps = RuleProps & { typedData: TypedDataPayload }

type MessageRuleProps = RuleProps & { message: string }

/** A Polymarket proxy's deletion: the key the request says it deletes, whose hash the typed data must sign. */
type PolymarketDeletionProps = TypedRuleProps & { deletes: KeyDeletion | undefined }

/** GMX's subaccount approval, with the terms the request states beside it, which must be the ones signed. */
type GmxApprovalRuleProps = TypedRuleProps & { approval: GmxSubaccountApprovalFacts | undefined }

/** Main's USDC permit for GMX's Router, with the spender the request states beside it, which must be the one signed. */
type GmxPermitRuleProps = TypedRuleProps & { permit: GmxUsdcPermitFacts | undefined }

type ExpectedDomainProps = { typedData: TypedDataPayload; domain: Readonly<Record<string, unknown>> }

type ExpectedTypesProps = {
  typedData: TypedDataPayload
  types: Readonly<Record<string, readonly { name: string; type: string }[]>>
  primaryType: string
}

type QueryFieldsProps = { query: string; names: readonly string[] }

type RecipientSubAccountProps = { address: unknown; accounts: readonly RuleAccount[] }

/**
 * The user's accounts and the sub-accounts shared with them as the service lists them, and the recipients Main's
 * address book approves, where it's read.
 */
type ApprovalsProps = Pick<SignableRequestProps, "accounts" | "shared" | "approvedRecipients">

type SameAddressProps = { address: unknown; other: string }

type ChainOfProps = { typedData: TypedDataPayload }

type AllowedChainProps = { chainId: number; allowed: readonly (number | null)[] }

type UntilProps = { ms: number }

type AtMostProps = { value: number; max: number }

type RefuseProps = { refusal: SignableRefusal | string }

type SameDomainValueProps = { value: unknown; expected: unknown }

type ValueProps = { value: unknown }

type DelegateProps = { address: unknown; main: string }

/** One of lebroker's agents on Aster: its kind, its Spot and perps permissions as the query writes them, its summary. */
type AsterAgentTerms = { kind: AsterAgentKind; spot: string; perp: string; action: SignSummaryText }

type AmountProps = { value: unknown; symbol: string }

type ToAccountProps = { account: SignableAccount }

/**
 * Typed data for a LaMarge move, and the take its request names, null for none: what a take's payment is checked
 * against; and a send's terms, null for none.
 */
type LaMargeTypedRuleProps = TypedRuleProps & {
  take: LaMargeTake | null
  lamarge: LaMargeRequestContext | null
  send: LaMargeSend | null
}

/** A LaMarge send's typed data, and its terms as the request names them. */
type LaMargeSendRuleProps = LaMargeTypedRuleProps & { send: LaMargeSend }

/** A send's typed data, and the Polymarket operation it hashes, when the request carries one. */
type SendTypedProps = { typedData: TypedDataPayload; op: LaMargeOp | undefined }

/** A message for a LaMarge move, and the take its request names, null for none. */
type LaMargeMessageRuleProps = MessageRuleProps & { take: LaMargeTake | null; lamarge: LaMargeRequestContext | null }

/**
 * A LaMarge deployment Main signs for: its app's origin, its own slots on Main's venue accounts (the name its Aster
 * agent goes by, its Lighter key's index), and its own escrows' addresses.
 */
type LaMargeDeploymentPins = {
  appOrigin: string
  environment: Environment
  asterAgentName: string
  lighterKeyIndex: number
  escrows: readonly string[]
}

/** A LaMarge deployment Main signs for. */
type DeploymentEscrowsProps = { deployment: LaMargeDeploymentPins }

/** One payment of a take, as LaMarge's SDK reads it from the request. */
type DeliveryVenueProps = { paid: Record<string, unknown> }

/** A take's payments, as LaMarge's SDK reads them from the request. */
type TakePaymentsProps = { payments: readonly Record<string, unknown>[] }

/**
 * A take's payments; the venue whose escrow they pay into, in whose token their amounts count; and the one venue they
 * deliver on, in whose token what they bring back counts.
 */
type KeepsValueProps = TakePaymentsProps & { venue: string; delivery: string }

/**
 * A take's payment, the venue whose deposit address for Main the request says it delivers into straight (none, absent),
 * and that address as the signing side read it itself.
 */
type SignedDepositDeliveryProps = {
  paid: Record<string, unknown>
  depositVenue: VenueId | undefined
  depositAddress: ReadDepositAddress | undefined
}

/** Main's withdrawal, and the venue whose deposit address for Main it says it pays straight. */
type DepositWithdrawalRuleProps = TypedRuleProps & { depositVenue: VenueId }

/** Main's withdrawal signed as a message, and the venue whose deposit address for Main it says it pays straight. */
type DepositMessageRuleProps = MessageRuleProps & { depositVenue: VenueId }

/** Lighter's owner message for a transfer. */
type LighterMessageProps = Pick<MessageRuleProps, "message">

/** The LaMarge deployment a request says it's for, null when it says none. */
type DeploymentOfProps = { lamarge: LaMargeRequestContext | null }

/** Lighter's owner message for a transfer, as `LIGHTER_TRANSFER_MESSAGE` read it. */
type LighterTakeProps = LaMargeMessageRuleProps & { read: RegExpExecArray }

/** A field of a Lighter message, written in hex: an index or a nonce. */
type HexIndexProps = { hex: string | undefined }

/** Typed data for a LaMarge move, as its SDK checks it. */
type LaMargeTypedProps = LaMargeTypedRuleProps & { typed: Typed }

type VenueOfProps = { typed: Typed }

type SignedVenueOnProps = { chainId: number }

/**
 * LaMarge's attestation of a take where the signing side verified one; the venue Main pays from, and where each of its
 * deliveries goes, by LaMarge's venue id, to whom: as the request reads them.
 */
type AttestedDeliveryProps = {
  attested: Attested | undefined
  from: string
  deliveries: readonly { to: string; recipient: unknown }[]
}

/** Why the request is asked, as it says it. */
type StartedByProps = { reason: SignatureRequestReason }

/** An amount in a LaMarge venue's token's base units. */
type UnitsProps = { value: bigint; venue: string }

/** A check of LaMarge's SDK, which throws its own words: they become the refusal's. */
type LaMargeCheckProps<T> = { check: () => T }

type FeeNamedFillsProps = { take: LaMargeTake }

export type {
  PolymarketDeletionProps,
  GmxApprovalRuleProps,
  GmxPermitRuleProps,
  AsterAgentTerms,
  LaMargeSendRuleProps,
  SendTypedProps,
  ApprovalsProps,
  DeliveryVenueProps,
  DeploymentEscrowsProps,
  DeploymentOfProps,
  LaMargeDeploymentPins,
  AllowedChainProps,
  AmountProps,
  AtMostProps,
  ChainOfProps,
  DelegateProps,
  DepositWithdrawalRuleProps,
  DepositMessageRuleProps,
  LighterMessageProps,
  ExpectedDomainProps,
  ExpectedTypesProps,
  FeeNamedFillsProps,
  HexIndexProps,
  KeepsValueProps,
  LaMargeCheckProps,
  LaMargeMessageRuleProps,
  LaMargeTypedProps,
  LaMargeTypedRuleProps,
  LighterTakeProps,
  MessageRuleProps,
  NotSignableProps,
  QueryFieldsProps,
  ReadDepositAddress,
  RecipientSubAccountProps,
  RefuseProps,
  RuleAccount,
  RuleProps,
  SameAddressProps,
  SameDomainValueProps,
  SharedSignableAccount,
  SignedDepositDeliveryProps,
  SignedVenueOnProps,
  AttestedDeliveryProps,
  Signable,
  SignableRequestProps,
  SignSummary,
  StartedByProps,
  SteppedProps,
  SummaryLine,
  TakePaymentsProps,
  ToAccountProps,
  TypedRuleProps,
  UnitsProps,
  UntilProps,
  ValueProps,
  VenueOfProps,
}
