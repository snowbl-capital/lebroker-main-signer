import type { WalletInfo } from "../wallets/types"
import type { LogEvent } from "./enums"

/** A request as the logs name it: never its payload, nor its signature. */
type LoggedRequest = { id: string; kind: string; venue: string | null }

/** Words, numbers and flags only: no key material and no signature is ever given to a log. */
type LogFields = Record<string, string | number | boolean | null>

type LogProps = { event: LogEvent; wallet?: WalletInfo; request?: LoggedRequest; fields?: LogFields }

/** Writes one line: the terminal by default, a list in tests. */
type LogWriter = (line: string) => void

type Logger = (props: LogProps) => void

type CreateLoggerProps = { write?: LogWriter; now?: () => number }

export type { CreateLoggerProps, LogFields, LoggedRequest, Logger, LogProps, LogWriter }
