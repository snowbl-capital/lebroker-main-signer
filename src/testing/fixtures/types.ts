import type { Address, Hex } from "viem"
import type { AddressBookStatement, SignatureRequestKind } from "../../lebroker/accounts/model"
import type { SignatureRequestState } from "../../lebroker/accounts/model"
import type { VenueId } from "../../lebroker/core/model"
import type { AsterAgentKind } from "../../signableRequest/testing/builders/enums"
import type { LogEvent } from "../../log/enums"
import type { Logger } from "../../log/types"
import type { Timers } from "../../walletSigner/types"
import type { WalletKey } from "../../wallets/wallets"
import type { FakeApi, FakeUser } from "../fakeApi/types"

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

/**
 * Main's approval of one of lebroker's Aster agents: `user`, the Main it's for; `kind`, the agent, whose name and
 * permissions it asks as lebroker's builder writes them; `query`, fields changed after, by name.
 */
type AsterApprovalProps = {
  id: string
  accountId: string
  user: Address
  agent: Address
  kind: AsterAgentKind
  query?: Record<string, string>
  askedAt?: number
}

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

/**
 * One Main wallet's signer under test: `appOrigin`, the deployment it signs for, the fake service's own origin unless
 * said, as `LEBROKER_URL`'s is; `recordPath`, the file of its address book's record, a fresh one unless said.
 */
type SetUpProps = { label?: string; userId?: string; appOrigin?: string; now?: () => number; recordPath?: string }

/** What an address-book entry of a test's Main is written and listed with: its key, wallet, user, service and deployment. */
type AddressBookContext = { key: Hex; wallet: WalletKey; user: FakeUser; api: FakeApi; deployment: string }

/**
 * Main's address-book entry naming these addresses, as the web app writes it: an approval unless said, dated now unless
 * said, for the signer's deployment unless said, signed by Main's own key unless `key` says another, and listed by the
 * service with `listed` as its word of the recipients, the recipients by default.
 */
type ApproveProps = {
  ctx: AddressBookContext
  recipients: string[]
  statement?: AddressBookStatement
  at?: number
  deployment?: string
  key?: Hex
  listed?: string[]
}

export type {
  AddressBookContext,
  ApprovalProps,
  ApproveProps,
  AsterApprovalProps,
  FakeUserOfProps,
  LogCollector,
  LoggedLine,
  ManualTimers,
  MatchesProps,
  RequestProps,
  SetUpProps,
  TransferProps,
  WaitForProps,
}
