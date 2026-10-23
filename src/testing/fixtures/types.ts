import type { Address } from "viem"
import type { GasPurchaseContext, SignatureRequestKind } from "../../lebroker/accounts/model"
import type { SignatureRequestState } from "../../lebroker/accounts/model"
import type { VenueId } from "../../lebroker/core/model"
import type { LogEvent } from "../../log/enums"
import type { Logger } from "../../log/types"
import type { Timers } from "../../walletSigner/types"

type FakeUserOfProps = { id: string; address: Address; subAddress: Address }

type RequestProps = {
  id: string
  /** Main's account id: the request is Main's. */
  accountId: string
  kind?: SignatureRequestKind
  venue?: string | null
  /** The typed data asked, as a venue's builder makes it; or a personal message. */
  typedData?: unknown
  message?: string
  /** What a payment to the gas reserve says it buys, beside its typed data; none by default. */
  gas?: GasPurchaseContext
  /** The venue a withdrawal says it pays straight for Main, beside its typed data; none by default. */
  depositVenue?: VenueId
  state?: SignatureRequestState
  /** When it was asked, in ms; now by default. */
  createdAt?: number
  /** When it expires, in ms; a day after it was asked by default. */
  expiresAt?: number
}

type ApprovalProps = { id: string; accountId: string; agent: Address; askedAt?: number }

type TransferProps = { id: string; accountId: string; destination: Address; askedAt?: number }

type GasPaymentProps = { id: string; accountId: string; askedAt?: number }

/** A log line as JSON, read back. */
type LoggedLine = Record<string, unknown>

type WaitForProps = { event: LogEvent; stage?: string }

type MatchesProps = { line: LoggedLine; props: WaitForProps }

/** What a test logs to: the lines written, read back, and a wait for one to come. */
type LogCollector = {
  log: Logger
  lines: string[]
  read: () => LoggedLine[]
  /** Resolves when a line of this event (and stage) is written, or at once if one was. */
  waitFor: (props: WaitForProps) => Promise<void>
}

/** Timers that never fire on their own: no test waits on a clock. `tick` runs what `every` was given. */
type ManualTimers = Timers & { tick: () => void }

export type {
  ApprovalProps,
  FakeUserOfProps,
  GasPaymentProps,
  LogCollector,
  LoggedLine,
  ManualTimers,
  MatchesProps,
  RequestProps,
  TransferProps,
  WaitForProps,
}
