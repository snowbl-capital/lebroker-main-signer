import type { AddressBookList, ApiClient, Session } from "../api/types"
import type { LoggedRequest, Logger } from "../log/types"
import type { SignatureRequestView } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { AccountView } from "../lebroker/web/types"
import type { ReadDepositAddress } from "../signableRequest/types"
import type { WalletKey } from "../wallets/wallets"

type EveryProps = { ms: number; run: () => void }

type SleepProps = { ms: number; signal: AbortSignal }

/** The waits the signer makes: the runtime's by default, a test's own so no test waits on a clock. */
type Timers = {
  /** Runs `run` every `ms`; the answer stops it. */
  every: (props: EveryProps) => () => void
  /** Resolves after `ms`, or as soon as `signal` aborts. */
  sleep: (props: SleepProps) => Promise<void>
}

type CreateWalletSignerProps = {
  wallet: WalletKey
  client: ApiClient
  /** MAIN_CHAIN_ID: the chain the allowlist reads as the wallet's own; null for none. */
  chainId: number | null
  /**
   * The origin of the lebroker deployment it signs for, LEBROKER_URL's, never a request's word: the allowlist reads it
   * as the web reads its page's own, for the gas reserve that deployment pins (D51).
   */
  appOrigin: string
  log: Logger
  timers?: Timers
  now?: () => number
}

/** One Main wallet's signer: its passes over the waiting requests, its event stream and its polling. */
type WalletSigner = {
  /** Signs in, then watches the stream and polls, until stopped. */
  start: () => void
  /** One pass over the waiting requests, or the one under way and the one after it; never rejects. */
  pass: () => Promise<void>
  stop: () => Promise<void>
}

/** `approved`: the recipients this wallet's own key approved in its address book, each entry checked here (D70). */
type HandleProps = { request: SignatureRequestView; accounts: readonly AccountView[]; approved: readonly string[]; session: Session }

/** The entries as the service lists them, and the wallet's own address, the Main each must name and be signed by. */
type ApprovedRecipientsProps = { entries: AddressBookList["entries"]; main: string }

type AsksAddressBookEntryProps = { request: SignatureRequestView }

/** `reason`: the allowlist's refusal. `logged`: the request as the logs name it. */
type DeclineProps = { id: string; reason: string; logged: LoggedRequest }

type ErrorTextProps = { error: unknown }

type DepositVenueOfProps = { request: SignatureRequestView }

/** `address`: the signing wallet's own, the L1 address the venue's deposit address must credit. */
type CreateDepositAddressReaderProps = { address: string; now: () => number }

/** The deposit address a request pays, as read from its venue; none for another request, or when it can't be read. */
type DepositAddressReader = (props: DepositVenueOfProps) => Promise<ReadDepositAddress | undefined>

export type {
  ApprovedRecipientsProps,
  AsksAddressBookEntryProps,
  CreateDepositAddressReaderProps,
  CreateWalletSignerProps,
  DeclineProps,
  DepositAddressReader,
  DepositVenueOfProps,
  ErrorTextProps,
  EveryProps,
  HandleProps,
  SleepProps,
  Timers,
  WalletSigner,
}
