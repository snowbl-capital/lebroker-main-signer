import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getAddress, recoverTypedDataAddress, type Address } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { openAddressBookRecord } from "../addressBookRecord/addressBookRecord"
import { createApiClient } from "../api/api"
import { LogEvent, SessionStage, StreamStage } from "../log/enums"
import { addressBookMessage } from "../lebroker/accounts/addressBookMessage/addressBookMessage"
import {
  AccountKind,
  AccountState,
  AddressBookStatement,
  SignatureRequestKind,
  SignatureRequestState,
  typedDataFromWire,
  SignaturePayloadKind,
} from "../lebroker/accounts/model"
import { Network, VenueId } from "../lebroker/core/model"
import { SignableRefusal, SignSummaryText } from "../signableRequest/enums"
import { hyperliquidWithdrawRequest } from "../signableRequest/testing/builders/builders"
import { LEBROKER_LIVE } from "../signableRequest/testing/fixtures"
import { createFakeApi } from "../testing/fakeApi/fakeApi"
import type { FakeApi } from "../testing/fakeApi/types"
import {
  approvalRequest,
  fakeUserOf,
  gasPaymentRequest,
  lighterWithdrawalRequest,
  logCollector,
  manualTimers,
  requestOf,
  transferRequest,
} from "../testing/fixtures/fixtures"
import type { ApproveProps, SetUpProps } from "../testing/fixtures/types"
import { WalletKey } from "../wallets/wallets"
import { DEPOSIT_ADDRESS_CACHE_MS, DEPOSIT_ADDRESS_PAUSE_MS } from "./constants"
import { FailedStep, ReadSubject, SignerRefusal } from "./enums"
import { createWalletSigner } from "./walletSigner"

const AGENT = privateKeyToAccount(generatePrivateKey()).address
const SUB = privateKeyToAccount(generatePrivateKey()).address
const STRANGER = privateKeyToAccount(generatePrivateKey()).address

const opened: FakeApi[] = []

/** The address books' record files the tests wrote, removed after each. */
const recordFiles: string[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(api => api.stop()))
  await Promise.all(recordFiles.splice(0).map(path => rm(path, { force: true })))
})

/** A fresh file for an address book's record, removed after the test. */
function recordFile(): string {
  const path = join(tmpdir(), `main-signer-address-book-${randomUUID()}.json`)
  recordFiles.push(path)
  return path
}

/** One Main wallet, a throwaway key, signed in to a fake service of its own, with its address book's record. */
async function setUp({ label = "main", userId = "user-1", appOrigin, now, recordPath = recordFile() }: SetUpProps = {}) {
  const key = generatePrivateKey()
  const wallet = new WalletKey({ key, label })
  const user = fakeUserOf({ id: userId, address: wallet.info.address, subAddress: SUB })
  const api = createFakeApi({ users: [user] })
  opened.push(api)
  const logs = logCollector()
  const timers = manualTimers()
  const origin = appOrigin ?? api.url.origin
  const deployment = new URL(origin).host
  const client = createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logs.log })
  const signer = createWalletSigner({
    wallet,
    client,
    chainId: null,
    appOrigin: origin,
    record: await openAddressBookRecord({ path: recordPath, deployment }),
    log: logs.log,
    timers,
    ...(now === undefined ? {} : { now }),
  })
  return { key, wallet, user, api, logs, timers, signer, mainId: `${userId}-main`, deployment, recordPath }
}

/** Main's address-book entry naming these addresses, listed by the service; its message. */
async function approve({
  ctx,
  recipients,
  statement = AddressBookStatement.APPROVE,
  at = Date.now(),
  deployment = ctx.deployment,
  key = ctx.key,
  listed = recipients,
}: ApproveProps): Promise<string> {
  const message = addressBookMessage({
    statement,
    deployment,
    main: ctx.wallet.info.address,
    recipients: recipients.map((address, index) => ({ address, label: `Sub-account ${String(index + 1)}` })),
    at,
  })
  ctx.api.addEntry({
    userId: ctx.user.id,
    message,
    signature: await privateKeyToAccount(key).signMessage({ message }),
    recipients: listed.map(address => ({ address, label: "Sub-account" })),
  })
  return message
}

describe("a waiting request", () => {
  test("is signed with Main's key and sent, when the allowlist accepts it", async () => {
    const ctx = await setUp()
    const request = approvalRequest({ id: "req-1", accountId: ctx.mainId, agent: AGENT })
    ctx.api.addRequest({ userId: ctx.user.id, request })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-1"])
    const payload = request.payload
    if (payload.kind !== SignaturePayloadKind.TYPED_DATA) {
      throw new Error("typed data expected")
    }
    const signer = await recoverTypedDataAddress({
      ...typedDataFromWire({ payload: payload.typedData }),
      signature: ctx.api.submissions[0]?.signature ?? "0x",
    })
    expect(signer).toBe(ctx.wallet.info.address)
    const signed = ctx.logs.read().filter(line => line.event === LogEvent.SIGNED)
    expect(signed).toHaveLength(1)
    expect(signed[0]).toMatchObject({
      wallet: "main",
      address: ctx.wallet.info.address,
      requestId: "req-1",
      kind: request.kind,
      venue: "hyperliquid",
    })
  })

  test("is never signed when the allowlist refuses it, and the refusal is told once, to the logs and to lebroker", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "req-2", accountId: ctx.mainId, destination: STRANGER }) })
    await ctx.signer.pass()
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.calls.filter(call => call.endsWith("/sign"))).toHaveLength(0)
    const refused = ctx.logs.read().filter(line => line.event === LogEvent.REFUSED)
    expect(refused).toHaveLength(1)
    expect(refused[0]).toMatchObject({ requestId: "req-2", reason: SignableRefusal.NOT_YOUR_ACCOUNT })
    expect(ctx.api.declines).toEqual([{ requestId: "req-2", reason: SignableRefusal.NOT_YOUR_ACCOUNT }])
  })

  test("refused, is told to lebroker again once its stream opens again, as a restarted service forgot it", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "req-13", accountId: ctx.mainId, destination: STRANGER }) })
    await ctx.signer.pass()
    expect(ctx.api.declines).toHaveLength(1)
    ctx.signer.start()
    await ctx.logs.waitFor({ event: LogEvent.STREAM, stage: StreamStage.CONNECTED })
    await ctx.signer.pass()
    expect(ctx.api.declines.map(own => own.requestId)).toEqual(["req-13", "req-13"])
    expect(ctx.logs.read().filter(line => line.event === LogEvent.REFUSED)).toHaveLength(1)
    await ctx.signer.stop()
  })

  test("to one of the user's own sub-accounts, read again from the service, and approved in Main's address book, is signed", async () => {
    const ctx = await setUp()
    await approve({ ctx, recipients: [SUB] })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "req-3", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-3"])
    expect(ctx.api.calls).toContain("GET /api/v1/accounts")
    expect(ctx.api.calls).toContain("GET /api/v1/address-book")
  })

  test("left for later by the user, or expired, waits", async () => {
    const ctx = await setUp()
    const deferred = { ...approvalRequest({ id: "req-4", accountId: ctx.mainId, agent: AGENT }), state: SignatureRequestState.DEFERRED }
    const askedAt = Date.now() - 2 * 60 * 60 * 1000
    const expired = {
      ...approvalRequest({ id: "req-5", accountId: ctx.mainId, agent: AGENT, askedAt }),
      expiresAt: new Date(askedAt + 1000).toISOString(),
    }
    ctx.api.addRequest({ userId: ctx.user.id, request: deferred })
    ctx.api.addRequest({ userId: ctx.user.id, request: expired })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
  })

  test("is sent again after the service or its venue failed, then given up on a refusal", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-6", accountId: ctx.mainId, agent: AGENT }) })
    ctx.api.failNextSign({ status: 502, error: "Hyperliquid didn't answer" })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.logs.read().find(line => line.event === LogEvent.FAILED)).toMatchObject({ step: FailedStep.SEND, status: 502, retry: true })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-6"])

    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-7", accountId: ctx.mainId, agent: AGENT }) })
    ctx.api.failNextSign({ status: 422, error: "Hyperliquid refused the approval" })
    await ctx.signer.pass()
    await ctx.signer.pass()
    expect(ctx.api.calls.filter(call => call === "POST /api/v1/signature-requests/req-7/sign")).toHaveLength(1)
    expect(
      ctx.logs
        .read()
        .filter(line => line.event === LogEvent.FAILED)
        .at(-1),
    ).toMatchObject({ status: 422, retry: false })
  })
})

describe("Main's address book (lebroker's D70)", () => {
  test("a transfer to a listed sub-account no entry approves is refused, told to lebroker, and left for the browser", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-1", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines).toEqual([{ requestId: "book-1", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])
    expect(ctx.logs.read().find(line => line.event === LogEvent.REFUSED)).toMatchObject({
      requestId: "book-1",
      reason: SignableRefusal.NOT_IN_ADDRESS_BOOK,
    })
  })

  test("a transfer to a sub-account an entry signed by Main's own key approves is signed", async () => {
    const ctx = await setUp()
    await approve({ ctx, recipients: [SUB] })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-2", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-2"])
  })

  test("an entry another key signed, one naming another Main, or the service's word alone, approves nothing", async () => {
    const ctx = await setUp()
    const other = privateKeyToAccount(generatePrivateKey())
    // Main's own entry, signed by another key.
    await approve({ ctx, recipients: [SUB], key: generatePrivateKey() })
    // Another Main's entry, signed by that Main.
    const others = addressBookMessage({
      statement: AddressBookStatement.APPROVE,
      deployment: ctx.deployment,
      main: other.address,
      recipients: [{ address: SUB, label: "Sub-account 1" }],
      at: Date.now(),
    })
    ctx.api.addEntry({ userId: ctx.user.id, message: others, signature: await other.signMessage({ message: others }) })
    // An entry of Main's that approves another address, which the service lists as approving the sub-account.
    await approve({ ctx, recipients: [STRANGER], listed: [SUB] })
    // A signature that isn't one.
    const unsigned = addressBookMessage({
      statement: AddressBookStatement.APPROVE,
      deployment: ctx.deployment,
      main: ctx.wallet.info.address,
      recipients: [{ address: SUB, label: "Sub" }],
      at: Date.now(),
    })
    ctx.api.addEntry({ userId: ctx.user.id, message: unsigned, signature: "not hex" })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-3", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines).toEqual([{ requestId: "book-3", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])
  })

  test("an entry Main signed for another deployment approves nothing here: signed on dev, never read on live", async () => {
    const ctx = await setUp({ appOrigin: LEBROKER_LIVE })
    await approve({ ctx, recipients: [SUB], deployment: "app.dev.leneutre.trade" })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-13", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.declines).toEqual([{ requestId: "book-13", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])
    await approve({ ctx, recipients: [SUB], deployment: new URL(LEBROKER_LIVE).host })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-13"])
  })

  test("one entry approves several addresses: each sub-account it names is sent to", async () => {
    const ctx = await setUp()
    const second = privateKeyToAccount(generatePrivateKey()).address
    ctx.user.accounts.push({
      id: `${ctx.user.id}-sub-2`,
      name: "Sub-account 2",
      kind: AccountKind.SUB,
      slot: 2,
      address: second,
      state: AccountState.OPEN,
      active: false,
    })
    await approve({ ctx, recipients: [SUB, second] })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-4", accountId: ctx.mainId, destination: SUB }) })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-5", accountId: ctx.mainId, destination: second }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-4", "book-5"])
  })

  test("a later withdrawal holds over an older approval, though the service stops listing it, and after a restart", async () => {
    const ctx = await setUp()
    const at = Date.now()
    await approve({ ctx, recipients: [SUB], at })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-14", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-14"])

    const withdrawal = await approve({ ctx, recipients: [SUB], statement: AddressBookStatement.WITHDRAW, at: at + 1 })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-15", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.declines).toEqual([{ requestId: "book-15", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])

    // The service hides the withdrawal and lists the older approval alone: what the signer saw holds.
    ctx.api.removeEntry({ userId: ctx.user.id, message: withdrawal })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-16", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-14"])

    // A signer started again on the same record, against the same service: still withdrawn.
    const restarted = createWalletSigner({
      wallet: ctx.wallet,
      client: createApiClient({ baseUrl: ctx.api.url, wallet: ctx.wallet, chainId: null, log: ctx.logs.log }),
      chainId: null,
      appOrigin: ctx.api.url.origin,
      record: await openAddressBookRecord({ path: ctx.recordPath, deployment: ctx.deployment }),
      log: ctx.logs.log,
      timers: manualTimers(),
    })
    await restarted.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-14"])

    // Approved again, later still: sent to.
    await approve({ ctx, recipients: [SUB], at: at + 2 })
    await restarted.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-14", "book-15", "book-16"])
  })

  test("an entry dated past this machine's clock by more than the skew is ignored and never kept: a later withdrawal holds over a 2100 approval", async () => {
    const ctx = await setUp()
    const at = Date.now()
    await approve({ ctx, recipients: [SUB], at: Date.UTC(2100, 0, 1) })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-30", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.declines).toEqual([{ requestId: "book-30", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])

    await approve({ ctx, recipients: [SUB], at })
    await approve({ ctx, recipients: [SUB], statement: AddressBookStatement.WITHDRAW, at: at + 1 })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-31", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toEqual([])
    expect(ctx.api.declines.map(declined => declined.requestId)).toEqual(["book-30", "book-31"])
    const kept = await readFile(ctx.recordPath, "utf8")
    expect(kept).not.toContain("2100-01-01")
    expect(kept).toContain(new Date(at + 1).toISOString())
  })

  test("keeps in its record the entries it checked, as signed, and no key", async () => {
    const ctx = await setUp()
    const message = await approve({ ctx, recipients: [SUB] })
    await approve({ ctx, recipients: [STRANGER], key: generatePrivateKey() })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-17", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    const kept: unknown = JSON.parse(await readFile(ctx.recordPath, "utf8"))
    // A key's signature is the same each time over the same message (RFC 6979): the one listed.
    expect(kept).toEqual({ entries: [{ message, signature: await privateKeyToAccount(ctx.key).signMessage({ message }) }] })
    expect(JSON.stringify(kept).toLowerCase()).not.toContain(ctx.key.slice(2).toLowerCase())
  })

  test("matches an address whatever its case, in the request or in the user's accounts; an entry's own address is written checksummed", async () => {
    const ctx = await setUp()
    const lower: Address = `0x${SUB.slice(2).toLowerCase()}`
    // Asked in lower case, written checksummed in the entry.
    await approve({ ctx, recipients: [lower] })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-6", accountId: ctx.mainId, destination: lower }) })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-7", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-6", "book-7"])

    // An entry whose address isn't written checksummed, as lebroker never writes one, reads as no entry at all.
    const loose = await setUp({ userId: "user-2" })
    const message = addressBookMessage({
      statement: AddressBookStatement.APPROVE,
      deployment: loose.deployment,
      main: loose.wallet.info.address,
      recipients: [{ address: SUB, label: "Sub-account 1" }],
      at: Date.now(),
    }).replace(getAddress(SUB), lower)
    loose.api.addEntry({ userId: loose.user.id, message, signature: await privateKeyToAccount(loose.key).signMessage({ message }) })
    loose.api.addRequest({ userId: loose.user.id, request: transferRequest({ id: "book-8", accountId: loose.mainId, destination: SUB }) })
    await loose.signer.pass()
    expect(loose.api.declines).toEqual([{ requestId: "book-8", reason: SignableRefusal.NOT_IN_ADDRESS_BOOK }])
  })

  test("is never signed by the signer: a request for an entry, or a text that carries one, is refused and told to lebroker", async () => {
    const ctx = await setUp()
    const entry = addressBookMessage({
      statement: AddressBookStatement.APPROVE,
      deployment: ctx.deployment,
      main: ctx.wallet.info.address,
      recipients: [{ address: STRANGER, label: "Mine" }],
      at: Date.now(),
    })
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: requestOf({ id: "book-9", accountId: ctx.mainId, venue: VenueId.LIGHTER, message: entry }),
    })
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: requestOf({ id: "book-10", accountId: ctx.mainId, kind: SignatureRequestKind.LAMARGE_MOVE, message: `Sign in\n\n${entry}` }),
    })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines).toEqual([
      { requestId: "book-9", reason: SignerRefusal.ADDRESS_BOOK_ENTRY },
      { requestId: "book-10", reason: SignerRefusal.ADDRESS_BOOK_ENTRY },
    ])
  })

  test("a read that fails decides nothing: a transfer is neither signed nor declined, the rest is signed, and it's logged once", async () => {
    const ctx = await setUp()
    await approve({ ctx, recipients: [SUB] })
    ctx.api.failAddressBook({ failing: true })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-11", accountId: ctx.mainId, destination: SUB }) })
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "book-12", accountId: ctx.mainId, agent: AGENT }) })
    await ctx.signer.pass()
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-12"])
    expect(ctx.api.declines).toEqual([])
    expect(ctx.logs.read().filter(line => line.event === LogEvent.REFUSED)).toEqual([])
    const failed = ctx.logs.read().filter(line => line.event === LogEvent.READ_FAILED)
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ subject: ReadSubject.ADDRESS_BOOK })

    // Read again: the transfer the entry approves is signed.
    ctx.api.failAddressBook({ failing: false })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-12", "book-11"])
  })

  test("a record that can't be written is logged, and the entries checked hold for the run", async () => {
    const ctx = await setUp({ recordPath: join(tmpdir(), `main-signer-no-such-folder-${randomUUID()}`, "address-book.json") })
    await approve({ ctx, recipients: [SUB] })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "book-18", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["book-18"])
    expect(ctx.logs.read().find(line => line.event === LogEvent.FAILED)).toMatchObject({ step: FailedStep.RECORD })
  })
})

describe("a payment to lebroker's gas reserve (D51, phase 6)", () => {
  test("is signed for the deployment that pins the reserve, LEBROKER_URL's, and logged as what it pays", async () => {
    const ctx = await setUp({ appOrigin: LEBROKER_LIVE })
    ctx.api.addRequest({ userId: ctx.user.id, request: gasPaymentRequest({ id: "req-g1", accountId: ctx.mainId }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-g1"])
    expect(ctx.logs.read().find(line => line.event === LogEvent.SIGNED)).toMatchObject({
      requestId: "req-g1",
      kind: "gas-purchase",
      action: `${SignSummaryText.PAY_GAS_RESERVE} $0.15 ${SignSummaryText.FOR_GAS_ON} Arbitrum`,
      chainId: 42161,
    })
  })

  test("is refused, and told to lebroker, for a deployment that pins none, such as a local stack", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: gasPaymentRequest({ id: "req-g2", accountId: ctx.mainId }) })
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-g3", accountId: ctx.mainId, agent: AGENT }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-g3"])
    expect(ctx.api.declines).toEqual([{ requestId: "req-g2", reason: SignableRefusal.NO_GAS_RESERVE }])
  })
})

describe("Main's withdrawal straight into its own Lighter, which opens it (D56)", () => {
  /** Lighter's intent address for Main, as Lighter answers it. */
  const INTENT = privateKeyToAccount(generatePrivateKey()).address

  afterEach(() => {
    spyOn(globalThis, "fetch").mockRestore()
  })

  /** Main's withdrawal to the intent address, as `requestOf` makes it for any kind and venue. */
  function withdrawalTo({ id, accountId, kind, venue }: { id: string; accountId: string; kind: SignatureRequestKind; venue: string }) {
    const typedData = hyperliquidWithdrawRequest({
      destination: INTENT,
      amount: 6,
      time: Date.now(),
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    return requestOf({ id, accountId, kind, venue, typedData, depositVenue: VenueId.LIGHTER })
  }

  test("reads nothing from Lighter for a request of another kind or venue, whatever it names", async () => {
    const ctx = await setUp()
    const fetched = spyOn(globalThis, "fetch")
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: withdrawalTo({ id: "req-l5", accountId: ctx.mainId, kind: SignatureRequestKind.TRANSFER, venue: VenueId.HYPERLIQUID }),
    })
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: withdrawalTo({ id: "req-l6", accountId: ctx.mainId, kind: SignatureRequestKind.WITHDRAWAL, venue: VenueId.ASTER }),
    })
    await ctx.signer.pass()
    await ctx.signer.pass()
    expect(fetched).not.toHaveBeenCalled()
    expect(ctx.api.submissions).toHaveLength(0)
  })

  test("reuses Lighter's answer a short while, then reads it again", async () => {
    const clock = { ms: Date.now() }
    const ctx = await setUp({ now: () => clock.ms })
    const fetched = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ intent_address: INTENT }))
      .mockResolvedValueOnce(Response.json({ intent_address: INTENT }))
    for (const id of ["req-c1", "req-c2"]) {
      ctx.api.addRequest({ userId: ctx.user.id, request: lighterWithdrawalRequest({ id, accountId: ctx.mainId, destination: INTENT }) })
      await ctx.signer.pass()
    }
    expect(fetched).toHaveBeenCalledTimes(1)
    clock.ms += DEPOSIT_ADDRESS_CACHE_MS
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: lighterWithdrawalRequest({ id: "req-c3", accountId: ctx.mainId, destination: INTENT }),
    })
    await ctx.signer.pass()
    expect(fetched).toHaveBeenCalledTimes(2)
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-c1", "req-c2", "req-c3"])
  })

  test("stops reading Lighter a while after a 429, and signs nothing meanwhile", async () => {
    const clock = { ms: Date.now() }
    const ctx = await setUp({ now: () => clock.ms })
    const fetched = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ code: 429 }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ intent_address: INTENT }))
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: lighterWithdrawalRequest({ id: "req-p1", accountId: ctx.mainId, destination: INTENT }),
    })
    await ctx.signer.pass()
    clock.ms += DEPOSIT_ADDRESS_PAUSE_MS - 1
    await ctx.signer.pass()
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines).toEqual([{ requestId: "req-p1", reason: SignableRefusal.DEPOSIT_UNREAD }])
    clock.ms += 1
    await ctx.signer.pass()
    expect(fetched).toHaveBeenCalledTimes(2)
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-p1"])
  })

  test("is signed to the intent address the signer read itself from Lighter, for its own wallet, just before", async () => {
    const ctx = await setUp()
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ intent_address: INTENT.toLowerCase() }))
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: lighterWithdrawalRequest({ id: "req-l1", accountId: ctx.mainId, destination: INTENT }),
    })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-l1"])
    const url = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(`${url.origin}${url.pathname}`).toBe("https://mainnet.zklighter.elliot.ai/api/v1/createIntentAddress")
    expect(url.searchParams.get("chain_id")).toBe("42161")
    expect(url.searchParams.get("from_addr")).toBe(ctx.wallet.info.address)
    expect(ctx.logs.read().find(line => line.event === LogEvent.SIGNED)).toMatchObject({
      requestId: "req-l1",
      kind: "withdrawal",
      action: SignSummaryText.WITHDRAW_INTO_LIGHTER,
      chainId: 42161,
    })
  })

  test("is refused, and told to lebroker, when it pays another address than the one Lighter gives", async () => {
    const ctx = await setUp()
    spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ intent_address: INTENT }))
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: lighterWithdrawalRequest({ id: "req-l2", accountId: ctx.mainId, destination: STRANGER }),
    })
    await ctx.signer.pass()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines).toEqual([{ requestId: "req-l2", reason: SignableRefusal.NOT_DEPOSIT_ADDRESS }])
  })

  test("is never signed when Lighter can't be read: it fails, answers something else, or can't be reached", async () => {
    const answers = [
      { answer: Response.json({ code: 500 }, { status: 500 }) },
      { answer: Response.json({ intent_address: "not an address" }) },
      { error: new TypeError("Failed to fetch") },
    ]
    for (const [index, read] of answers.entries()) {
      const ctx = await setUp()
      const fetched = spyOn(globalThis, "fetch")
      if (read.answer === undefined) {
        fetched.mockRejectedValue(read.error)
      } else {
        fetched.mockResolvedValue(read.answer)
      }
      const id = `req-l3-${index}`
      ctx.api.addRequest({ userId: ctx.user.id, request: lighterWithdrawalRequest({ id, accountId: ctx.mainId, destination: INTENT }) })
      await ctx.signer.pass()
      expect(ctx.api.submissions).toHaveLength(0)
      expect(ctx.api.declines).toEqual([{ requestId: id, reason: SignableRefusal.DEPOSIT_UNREAD }])
      // The next wallet's client takes the runtime's fetch, not this read's.
      fetched.mockRestore()
    }
  })

  test("without a venue named, stays a withdrawal to Main's own address only, and reads nothing from Lighter", async () => {
    const ctx = await setUp()
    const fetched = spyOn(globalThis, "fetch")
    const typedData = hyperliquidWithdrawRequest({
      destination: INTENT,
      amount: 6,
      time: Date.now(),
      network: Network.MAINNET,
      signatureChainId: 42161,
    }).typedData
    ctx.api.addRequest({
      userId: ctx.user.id,
      request: requestOf({ id: "req-l4", accountId: ctx.mainId, kind: SignatureRequestKind.WITHDRAWAL, typedData }),
    })
    await ctx.signer.pass()
    expect(fetched).not.toHaveBeenCalled()
    expect(ctx.api.submissions).toHaveLength(0)
    expect(ctx.api.declines.map(own => own.requestId)).toEqual(["req-l4"])
  })
})

describe("the session", () => {
  test("is opened again when the service ends it (401), and the pass goes on", async () => {
    const ctx = await setUp()
    await ctx.signer.pass()
    ctx.api.expireSessions()
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-8", accountId: ctx.mainId, agent: AGENT }) })
    await ctx.signer.pass()
    expect(ctx.api.signIns).toHaveLength(2)
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-8"])
    expect(
      ctx.logs
        .read()
        .filter(line => line.event === LogEvent.SESSION)
        .map(line => line.stage),
    ).toEqual([SessionStage.SIGNED_IN, SessionStage.RENEWED])
  })
})

describe("the event stream", () => {
  test("starts a pass when the service tells a request was asked", async () => {
    const ctx = await setUp()
    ctx.signer.start()
    await ctx.logs.waitFor({ event: LogEvent.STREAM, stage: StreamStage.CONNECTED })
    // The pass the stream starts as it opens, for what was asked while it was down: done before the request is.
    await ctx.signer.pass()
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-9", accountId: ctx.mainId, agent: AGENT }) })
    ctx.api.push({ userId: ctx.user.id })
    const submission = await ctx.api.submitted({ requestId: "req-9" })
    expect(submission.address).toBe(ctx.wallet.info.address)
    await ctx.signer.stop()
  })

  test("polling reads the requests while the stream is down", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-10", accountId: ctx.mainId, agent: AGENT }) })
    ctx.timers.tick()
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-10"])
  })
})

describe("several wallets", () => {
  test("each signs its own requests, under its own session, and the logs name it", async () => {
    const keys = [generatePrivateKey(), generatePrivateKey()]
    const wallets = keys.map((key, index) => new WalletKey({ key, label: `wallet-${index + 1}` }))
    const users = wallets.map((wallet, index) => fakeUserOf({ id: `user-${index + 1}`, address: wallet.info.address, subAddress: SUB }))
    const api = createFakeApi({ users })
    opened.push(api)
    const logs = logCollector()
    // One record for every wallet, as the process keeps it.
    const record = await openAddressBookRecord({ path: recordFile(), deployment: api.url.host })
    const signers = wallets.map(wallet =>
      createWalletSigner({
        wallet,
        client: createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logs.log }),
        chainId: null,
        appOrigin: api.url.origin,
        record,
        log: logs.log,
        timers: manualTimers(),
      }),
    )
    users.forEach((user, index) => {
      api.addRequest({ userId: user.id, request: approvalRequest({ id: `req-w${index + 1}`, accountId: `${user.id}-main`, agent: AGENT }) })
    })
    await Promise.all(signers.map(signer => signer.pass()))
    expect(api.submissions.map(own => [own.requestId, own.address]).sort()).toEqual([
      ["req-w1", wallets[0]?.info.address ?? ""],
      ["req-w2", wallets[1]?.info.address ?? ""],
    ])
    expect(
      logs
        .read()
        .filter(line => line.event === LogEvent.SIGNED)
        .map(line => [line.wallet, line.requestId])
        .sort(),
    ).toEqual([
      ["wallet-1", "req-w1"],
      ["wallet-2", "req-w2"],
    ])
  })
})

describe("the logs", () => {
  test("hold no key and no signature", async () => {
    const ctx = await setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: approvalRequest({ id: "req-11", accountId: ctx.mainId, agent: AGENT }) })
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "req-12", accountId: ctx.mainId, destination: STRANGER }) })
    await ctx.signer.pass()
    const text = ctx.logs.lines.join("\n").toLowerCase()
    expect(text).not.toContain(ctx.key.slice(2).toLowerCase())
    for (const submission of ctx.api.submissions) {
      expect(text).not.toContain(submission.signature.slice(2).toLowerCase())
    }
    expect(ctx.api.submissions).toHaveLength(1)
  })
})
