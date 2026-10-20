import type { Address, Hex } from "viem"
import type { SignaturePayload } from "../../lebroker/accounts/model"
import type { SignatureRequestView } from "../../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import type { AccountView } from "../../lebroker/web/types"

/** A user of the fake service: Main's address, and their accounts, Main first. */
type FakeUser = { id: string; address: Address; accounts: AccountView[] }

type FakeApiProps = { users: FakeUser[] }

/** A signature the fake took, checked: it recovers to Main's address. */
type Submission = { requestId: string; address: Address; signature: Hex }

/** A sign-in the fake accepted, as its message read. */
type SignIn = { address: Address; domain: string; uri: string; statement: string | null; chainId: number; resources: string[] }

/** A refusal the signer told the fake. */
type Decline = { requestId: string; reason: string }

type AddRequestProps = { userId: string; request: SignatureRequestView }

type UserProps = { userId: string }

type FailSignProps = { status: number; error: string }

type RequestIdProps = { requestId: string }

type FakeApi = {
  url: URL
  submissions: Submission[]
  signIns: SignIn[]
  declines: Decline[]
  /** Every call the fake answered, `METHOD path`, in order. */
  calls: string[]
  addRequest: (props: AddRequestProps) => void
  /** Tells the user's open streams a request was asked or settled, as the service does. */
  push: (props: UserProps) => void
  /** Ends every session: the next call of each answers 401. */
  expireSessions: () => void
  /** The next submission is refused with this status, as when the venue fails. */
  failNextSign: (props: FailSignProps) => void
  /** Resolves once a signature for this request is taken. */
  submitted: (props: RequestIdProps) => Promise<Submission>
  stop: () => Promise<void>
}

type VerifyProps = { address: Address; payload: SignaturePayload; signature: Hex }

type JsonProps = { body: unknown; status?: number; headers?: Record<string, string> }

type RequestProps = { request: Request }

type UserRequestProps = RequestProps & { user: FakeUser }

type SignRouteProps = UserRequestProps & { id: string }

type SessionBodyProps = { user: FakeUser }

export type {
  AddRequestProps,
  Decline,
  FailSignProps,
  FakeApi,
  FakeApiProps,
  FakeUser,
  JsonProps,
  RequestIdProps,
  RequestProps,
  SessionBodyProps,
  SignIn,
  SignRouteProps,
  Submission,
  UserProps,
  UserRequestProps,
  VerifyProps,
}
