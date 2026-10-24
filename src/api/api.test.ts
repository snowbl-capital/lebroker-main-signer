import { afterEach, describe, expect, test } from "bun:test"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { MAIN_SIGNER_RESOURCE } from "../lebroker/accounts/constants"
import { SIGN_IN_STATEMENT } from "../lebroker/web/hooks/session/useSessionMutationSignIn/constants"
import { createFakeApi } from "../testing/fakeApi/fakeApi"
import type { FakeApi } from "../testing/fakeApi/types"
import { fakeUserOf, logCollector } from "../testing/fixtures/fixtures"
import { WalletKey } from "../wallets/wallets"
import { createApiClient } from "./api"
import { ApiErrorText } from "./enums"
import { ApiError } from "./errors"

const SUB = privateKeyToAccount(generatePrivateKey()).address
const opened: FakeApi[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map(api => api.stop()))
})

describe("signing in", () => {
  test("is the web app's: a fresh nonce, a SIWE message naming the service's own host, Main's signature, a session cookie", async () => {
    const wallet = new WalletKey({ key: generatePrivateKey(), label: "main" })
    const api = createFakeApi({ users: [fakeUserOf({ id: "user-1", address: wallet.info.address, subAddress: SUB })] })
    opened.push(api)
    const client = createApiClient({ baseUrl: api.url, wallet, chainId: 42161, log: logCollector().log })
    const session = await client.signIn()
    expect(session.user).toMatchObject({ id: "user-1", address: wallet.info.address })
    expect(session.accountId).toBe("user-1-main")
    expect(api.signIns).toEqual([
      {
        address: wallet.info.address,
        domain: api.url.host,
        uri: api.url.origin,
        statement: SIGN_IN_STATEMENT,
        chainId: 42161,
        // What makes the session the signer's, in what the wallet signs: lebroker counts it as connected.
        resources: [MAIN_SIGNER_RESOURCE],
      },
    ])
    expect(api.calls.slice(0, 2)).toEqual(["POST /api/v1/session/nonce", "POST /api/v1/session"])
    await client.accounts()
    expect(api.signIns).toHaveLength(1)
  })

  test("is refused for a wallet the service doesn't know, in the service's words", async () => {
    const wallet = new WalletKey({ key: generatePrivateKey(), label: "stranger" })
    const api = createFakeApi({ users: [] })
    opened.push(api)
    const client = createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logCollector().log })
    const refused = await client.signIn().catch((error: unknown) => error)
    expect(refused).toBeInstanceOf(ApiError)
    expect(refused instanceof ApiError ? refused.status : null).toBe(401)
  })

  test("is refused when the service's session names another address than the wallet's, so nothing is signed on it", async () => {
    const wallet = new WalletKey({ key: generatePrivateKey(), label: "main" })
    const api = createFakeApi({ users: [fakeUserOf({ id: "user-1", address: wallet.info.address, subAddress: SUB })], answerAs: SUB })
    opened.push(api)
    const client = createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logCollector().log })
    const refused = await client.signIn().catch((error: unknown) => error)
    expect(refused instanceof ApiError ? refused.message : null).toBe(ApiErrorText.OTHER_USER)
    expect(client.session()).toBeNull()
  })

  test("happens once for calls refused together after the session ended", async () => {
    const wallet = new WalletKey({ key: generatePrivateKey(), label: "main" })
    const api = createFakeApi({ users: [fakeUserOf({ id: "user-1", address: wallet.info.address, subAddress: SUB })] })
    opened.push(api)
    const client = createApiClient({ baseUrl: api.url, wallet, chainId: null, log: logCollector().log })
    await client.signIn()
    api.expireSessions()
    await Promise.all([client.accounts(), client.signatureRequests()])
    expect(api.signIns).toHaveLength(2)
  })
})
