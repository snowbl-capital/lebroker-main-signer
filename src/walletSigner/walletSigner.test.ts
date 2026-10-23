import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { recoverTypedDataAddress } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { createApiClient } from "../api/api"
import { LogEvent, SessionStage, StreamStage } from "../log/enums"
import { SignatureRequestKind, SignatureRequestState, typedDataFromWire, SignaturePayloadKind } from "../lebroker/accounts/model"
import { Network } from "../lebroker/core/model"
import { SignableRefusal, SignSummaryText } from "../signableRequest/enums"
import { hyperliquidWithdrawRequest } from "../signableRequest/testing/builders/builders"
import { LEBROKER_DEV } from "../signableRequest/testing/fixtures"
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
import { WalletKey } from "../wallets/wallets"
import { FailedStep } from "./enums"
import { createWalletSigner } from "./walletSigner"

const AGENT = privateKeyToAccount(generatePrivateKey()).address
const SUB = privateKeyToAccount(generatePrivateKey()).address
const STRANGER = privateKeyToAccount(generatePrivateKey()).address

const opened: FakeApi[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(api => api.stop()))
})

/**
 * One Main wallet, a throwaway key, signed in to a fake service of its own; `appOrigin`, the deployment it signs for,
 * the fake service's own origin unless said, as `LEBROKER_URL`'s is.
 */
function setUp({ label = "main", userId = "user-1", appOrigin }: { label?: string; userId?: string; appOrigin?: string } = {}) {
  const key = generatePrivateKey()
  const wallet = new WalletKey({ key, label })
  const user = fakeUserOf({ id: userId, address: wallet.info.address, subAddress: SUB })
  const api = createFakeApi({ users: [user] })
  opened.push(api)
  const logs = logCollector()
  const timers = manualTimers()
  const client = createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logs.log })
  const signer = createWalletSigner({ wallet, client, chainId: null, appOrigin: appOrigin ?? api.url.origin, log: logs.log, timers })
  return { key, wallet, user, api, logs, timers, signer, mainId: `${userId}-main` }
}

describe("a waiting request", () => {
  test("is signed with Main's key and sent, when the allowlist accepts it", async () => {
    const ctx = setUp()
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
    const ctx = setUp()
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
    const ctx = setUp()
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

  test("to one of the user's own sub-accounts, read again from the service, is signed", async () => {
    const ctx = setUp()
    ctx.api.addRequest({ userId: ctx.user.id, request: transferRequest({ id: "req-3", accountId: ctx.mainId, destination: SUB }) })
    await ctx.signer.pass()
    expect(ctx.api.submissions.map(own => own.requestId)).toEqual(["req-3"])
    expect(ctx.api.calls).toContain("GET /api/v1/accounts")
  })

  test("left for later by the user, or expired, waits", async () => {
    const ctx = setUp()
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
    const ctx = setUp()
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

describe("a payment to lebroker's gas reserve (D51, phase 6)", () => {
  test("is signed for the deployment that pins the reserve, LEBROKER_URL's, and logged as what it pays", async () => {
    const ctx = setUp({ appOrigin: LEBROKER_DEV })
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
    const ctx = setUp()
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

  test("is signed to the intent address the signer read itself from Lighter, for its own wallet, just before", async () => {
    const ctx = setUp()
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
    const ctx = setUp()
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
      const ctx = setUp()
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
    const ctx = setUp()
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
    const ctx = setUp()
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
    const ctx = setUp()
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
    const ctx = setUp()
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
    const signers = wallets.map(wallet =>
      createWalletSigner({
        wallet,
        client: createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logs.log }),
        chainId: null,
        appOrigin: api.url.origin,
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
    const ctx = setUp()
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
