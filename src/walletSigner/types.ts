import type { ApiClient, Session } from "../api/types"
import type { LoggedRequest, Logger } from "../log/types"
import type { SignatureRequestView } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { AccountView } from "../lebroker/web/types"
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

type HandleProps = { request: SignatureRequestView; accounts: readonly AccountView[]; session: Session }

/** `reason`: the allowlist's refusal. `logged`: the request as the logs name it. */
type DeclineProps = { id: string; reason: string; logged: LoggedRequest }

type ErrorTextProps = { error: unknown }

export type { CreateWalletSignerProps, DeclineProps, ErrorTextProps, EveryProps, HandleProps, SleepProps, Timers, WalletSigner }
