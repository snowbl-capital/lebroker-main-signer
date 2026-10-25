// A stand-in for lebroker's hosted account process, for tests: its sign-in, session cookie, origin check, accounts,
// signature requests and event stream, each checked as the service checks them, and an address book listed as given,
// unchecked, as a service gone wrong may list it. Tests only.
import { randomUUID } from "node:crypto"
import { getAddress, verifyMessage, verifyTypedData } from "viem"
import { parseSiweMessage } from "viem/siwe"
import { ApiRoute, HttpMethod } from "../../api/enums"
import { parseAddressBookMessage } from "../../lebroker/accounts/addressBookMessage/addressBookMessage"
import {
  AddressBookStatement,
  SignatureRequestState,
  SignaturePayloadKind,
  typedDataFromWire,
  UserAccess,
  WalletKind,
} from "../../lebroker/accounts/model"
import type { SignatureRequestView } from "../../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import { DECLINE_ROUTE, SESSION_COOKIE, SESSION_TTL_MS, SIGN_ROUTE, SIGNATURE_REQUESTS_FRAME } from "./constants"
import { declineBody, signBody, signInBody } from "./schema"
import type {
  Decline,
  FailSignProps,
  FakeApi,
  FakeApiProps,
  FakeEntry,
  FakeUser,
  JsonProps,
  RequestProps,
  SessionBodyProps,
  SignIn,
  SignRouteProps,
  Submission,
  UserRequestProps,
  VerifyProps,
} from "./types"

async function verify({ address, payload, signature }: VerifyProps): Promise<boolean> {
  if (payload.kind === SignaturePayloadKind.PERSONAL_MESSAGE) {
    return verifyMessage({ address, message: payload.message, signature })
  }
  return verifyTypedData({ address, signature, ...typedDataFromWire({ payload: payload.typedData }) })
}

function json({ body, status = 200, headers = {} }: JsonProps): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
}

function sessionBody({ user }: SessionBodyProps) {
  return {
    user: { id: user.id, address: user.address, walletKind: WalletKind.EOA, access: UserAccess.ADMITTED },
    accountId: user.accounts[0]?.id ?? null,
    address: user.address,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  }
}

/** A change must come from the service's own origin, which the browser names: lebroker's `sameOrigin`. */
function sameOrigin({ request }: RequestProps): boolean {
  const origin = URL.parse(request.headers.get("origin") ?? "")
  return origin !== null && origin.host === request.headers.get("host")
}

function createFakeApi({ users, answerAs }: FakeApiProps): FakeApi {
  const nonces = new Set<string>()
  const sessions = new Map<string, FakeUser>()
  const requests = new Map<string, SignatureRequestView[]>()
  const streams = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>()
  const waiters = new Map<string, (submission: Submission) => void>()
  const submissions: Submission[] = []
  const signIns: SignIn[] = []
  const declines: Decline[] = []
  const calls: string[] = []
  const books = new Map<string, FakeEntry[]>()
  const encoder = new TextEncoder()
  let failure: FailSignProps | null = null
  let bookFails = false

  function userOf({ request }: RequestProps): FakeUser | null {
    const pair = (request.headers.get("cookie") ?? "")
      .split(";")
      .map(part => part.trim())
      .find(part => part.startsWith(`${SESSION_COOKIE}=`))
    return pair === undefined ? null : (sessions.get(pair.slice(SESSION_COOKIE.length + 1)) ?? null)
  }

  async function signIn({ request }: RequestProps): Promise<Response> {
    const body = signInBody.parse(await request.json())
    const fields = parseSiweMessage(body.message)
    if (fields.domain !== request.headers.get("host") || fields.nonce === undefined || !nonces.delete(fields.nonce)) {
      return json({ body: { error: "The sign-in message was made for another site" }, status: 400 })
    }
    const user = users.find(own => fields.address !== undefined && own.address === getAddress(fields.address))
    if (user === undefined || !(await verifyMessage({ address: user.address, message: body.message, signature: body.signature }))) {
      return json({ body: { error: "The signature doesn't match the wallet" }, status: 401 })
    }
    signIns.push({
      address: user.address,
      domain: fields.domain,
      uri: fields.uri ?? "",
      statement: fields.statement ?? null,
      chainId: fields.chainId ?? 0,
      resources: fields.resources ?? [],
    })
    const token = randomUUID()
    sessions.set(token, user)
    return json({
      body: sessionBody({ user: answerAs === undefined ? user : { ...user, address: answerAs } }),
      headers: { "set-cookie": `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` },
    })
  }

  function events({ user }: UserRequestProps): Response {
    let opened: ReadableStreamDefaultController<Uint8Array> | null = null
    const stream = new ReadableStream<Uint8Array>({
      start: controller => {
        opened = controller
        const set = streams.get(user.id) ?? new Set()
        set.add(controller)
        streams.set(user.id, set)
        controller.enqueue(encoder.encode(": open\n\n"))
      },
      cancel: () => {
        if (opened !== null) {
          streams.get(user.id)?.delete(opened)
        }
      },
    })
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } })
  }

  async function sign({ request, user, id }: SignRouteProps): Promise<Response> {
    const body = signBody.parse(await request.json())
    const found = (requests.get(user.id) ?? []).find(own => own.id === id)
    if (found === undefined) {
      return json({ body: { error: "This signature request isn't yours, or it's gone" }, status: 404 })
    }
    if (found.state !== SignatureRequestState.WAITING && found.state !== SignatureRequestState.DEFERRED) {
      return json({ body: { error: "This signature request was already signed, or it expired" }, status: 409 })
    }
    if (!(await verify({ address: user.address, payload: found.payload, signature: body.signature }))) {
      return json({ body: { error: "This signature isn't Main's: sign it with the wallet you signed in with" }, status: 400 })
    }
    if (failure !== null) {
      const failed = failure
      failure = null
      return json({ body: { error: failed.error }, status: failed.status })
    }
    found.state = SignatureRequestState.SIGNED
    const submission = { requestId: id, address: user.address, signature: body.signature }
    submissions.push(submission)
    waiters.get(id)?.(submission)
    return json({ body: { request: found } })
  }

  async function decline({ request, user, id }: SignRouteProps): Promise<Response> {
    const body = declineBody.parse(await request.json())
    const found = (requests.get(user.id) ?? []).find(own => own.id === id)
    if (found === undefined) {
      return json({ body: { error: "This signature request isn't yours, or it's gone" }, status: 404 })
    }
    found.signerDeclined = body.reason
    declines.push({ requestId: id, reason: body.reason })
    return json({ body: { request: found } })
  }

  async function route({ request }: RequestProps): Promise<Response> {
    const url = new URL(request.url)
    const key = `${request.method} ${url.pathname}`
    calls.push(key)
    if (request.method !== HttpMethod.GET && !sameOrigin({ request })) {
      return json({ body: { error: "This change must come from the executor's own page" }, status: 403 })
    }
    if (key === `${HttpMethod.POST} ${ApiRoute.NONCE}`) {
      const nonce = randomUUID().replaceAll("-", "")
      nonces.add(nonce)
      return json({ body: { nonce } })
    }
    if (key === `${HttpMethod.POST} ${ApiRoute.SESSION}`) {
      return signIn({ request })
    }
    const user = userOf({ request })
    if (user === null) {
      return json({ body: { error: "Sign in first" }, status: 401 })
    }
    switch (key) {
      case `${HttpMethod.GET} ${ApiRoute.SESSION}`:
        return json({ body: sessionBody({ user }) })
      case `${HttpMethod.GET} ${ApiRoute.ACCOUNTS}`:
        return json({ body: { activeAccountId: user.accounts[0]?.id ?? null, accounts: user.accounts, closed: [] } })
      case `${HttpMethod.GET} ${ApiRoute.SIGNATURE_REQUESTS}`: {
        const open = (requests.get(user.id) ?? []).filter(
          own => own.state === SignatureRequestState.WAITING || own.state === SignatureRequestState.DEFERRED,
        )
        return json({
          body: {
            requests: open,
            waiting: open.filter(own => own.state === SignatureRequestState.WAITING).length,
            mainSigner: { connected: (streams.get(user.id)?.size ?? 0) > 0, since: null },
          },
        })
      }
      case `${HttpMethod.GET} ${ApiRoute.ADDRESS_BOOK}`:
        return bookFails
          ? json({ body: { error: "The address book can't be read now" }, status: 503 })
          : json({
              body: {
                entries: (books.get(user.id) ?? []).map((entry, index) => ({
                  id: `entry-${index + 1}`,
                  ...entry,
                  // The service's word of what the entry says, read here from the message, which nothing checks.
                  statement: parseAddressBookMessage({ message: entry.message })?.statement ?? AddressBookStatement.APPROVE,
                  deployment: parseAddressBookMessage({ message: entry.message })?.deployment ?? "",
                  signedAt: new Date(0).toISOString(),
                  addedAt: new Date(0).toISOString(),
                })),
              },
            })
      case `${HttpMethod.GET} ${ApiRoute.EVENTS}`:
        return events({ request, user })
      default:
        break
    }
    const action = SIGN_ROUTE.exec(url.pathname)
    if (request.method === HttpMethod.POST && action !== null) {
      return sign({ request, user, id: action[1] ?? "" })
    }
    const declining = DECLINE_ROUTE.exec(url.pathname)
    if (request.method === HttpMethod.POST && declining !== null) {
      return decline({ request, user, id: declining[1] ?? "" })
    }
    return json({ body: { error: "Not found" }, status: 404 })
  }

  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: request => route({ request }) })

  return {
    url: new URL(`http://127.0.0.1:${server.port}`),
    submissions,
    signIns,
    declines,
    calls,
    addRequest: ({ userId, request }) => {
      requests.set(userId, [...(requests.get(userId) ?? []), request])
    },
    push: ({ userId }) => {
      for (const controller of streams.get(userId) ?? []) {
        controller.enqueue(encoder.encode(SIGNATURE_REQUESTS_FRAME))
      }
    },
    expireSessions: () => sessions.clear(),
    failNextSign: props => {
      failure = props
    },
    addEntry: ({ userId, message, signature, recipients = [] }) => {
      books.set(userId, [...(books.get(userId) ?? []), { message, signature, recipients }])
    },
    removeEntry: ({ userId, message }) => {
      books.set(
        userId,
        (books.get(userId) ?? []).filter(entry => entry.message !== message),
      )
    },
    failAddressBook: ({ failing }) => {
      bookFails = failing
    },
    submitted: ({ requestId }) =>
      new Promise(resolve => {
        const already = submissions.find(own => own.requestId === requestId)
        if (already !== undefined) {
          resolve(already)
          return
        }
        waiters.set(requestId, resolve)
      }),
    stop: async () => {
      for (const set of streams.values()) {
        for (const controller of set) {
          try {
            controller.close()
          } catch {
            // Already closed by its reader.
          }
        }
      }
      await server.stop(true)
    },
  }
}

export { createFakeApi }
