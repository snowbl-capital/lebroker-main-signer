import type { Hex } from "viem"
import type { z } from "zod"
import type { Logger } from "../log/types"
import type { accountsList } from "../lebroker/web/hooks/accounts/useAccountsQueryList/schema"
import type { requestAnswer } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/schema"
import type { SignatureRequestsList } from "../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { SessionUser } from "../lebroker/web/types"
import type { WalletKey } from "../wallets/wallets"
import type { ApiRoute, HttpMethod } from "./enums"
import type { sessionBody } from "./schema"

type SessionBody = z.output<typeof sessionBody>

/** A session of the hosted service's: its user, Main, whose wallet signs. */
type Session = { user: SessionUser; accountId: string | null }

type AccountsList = z.output<typeof accountsList>

type RequestAnswer = z.output<typeof requestAnswer>

type CreateApiClientProps = {
  /** The service's origin. */
  baseUrl: URL
  wallet: WalletKey
  /** The chain a sign-in message names; null for Ethereum's. */
  chainId: number | null
  log: Logger
  fetch?: typeof globalThis.fetch
  now?: () => number
}

type SignProps = { id: string; signature: Hex }

/** `reason`: the allowlist's refusal, in its words. */
type DeclineProps = { id: string; reason: string }

type EventsProps = { signal: AbortSignal }

/** One wallet's calls to lebroker, under its own session: signed in on first use, and again when it ends (401). */
type ApiClient = {
  signIn: () => Promise<Session>
  /** The session's user, once signed in; null before. */
  session: () => Session | null
  signatureRequests: () => Promise<SignatureRequestsList>
  accounts: () => Promise<AccountsList>
  sign: (props: SignProps) => Promise<RequestAnswer>
  /** Tells lebroker this signer won't sign the request, and why: the user is offered it in the browser. */
  decline: (props: DeclineProps) => Promise<RequestAnswer>
  /** The event stream's open response, its body still to read. */
  events: (props: EventsProps) => Promise<Response>
}

type ApiErrorProps = { message: string; status: number | null }

type CallProps = {
  method: HttpMethod
  route: ApiRoute
  /** After the route: `/<id>/sign`. */
  suffix?: string
  body?: unknown
  signal?: AbortSignal
  accept?: string
}

type ReadProps<T> = { response: Response; schema: z.ZodType<T> }

type SessionCookieProps = { response: Response }

export type {
  AccountsList,
  ApiClient,
  ApiErrorProps,
  CallProps,
  CreateApiClientProps,
  DeclineProps,
  EventsProps,
  ReadProps,
  RequestAnswer,
  Session,
  SessionBody,
  SessionCookieProps,
  SignProps,
}
