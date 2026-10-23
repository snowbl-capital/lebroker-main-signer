// What the signer's tests build on: users of the fake service, their requests as the service lists them, timers that
// never fire on their own, and a log read back. Tests only.
import {
  AccountKind,
  AccountState,
  SignatureRequestKind,
  SignatureRequestReason,
  SignatureRequestState,
  SignaturePayloadKind,
} from "../../lebroker/accounts/model"
import { Network, VenueId } from "../../lebroker/core/model"
import { HYPERLIQUID_AGENT_NAME, HYPERLIQUID_SEND_DEX, HYPERLIQUID_USDC } from "../../lebroker/venues/model"
import type { SignatureRequestView } from "../../lebroker/web/hooks/signatureRequests/useSignatureRequestsQueryList/types"
import { createLogger } from "../../log/log"
import { DEV_GAS_RESERVE, wire } from "../../signableRequest/testing/fixtures"
import {
  hyperliquidApproveAgentRequest,
  hyperliquidSendAssetRequest,
  hyperliquidWithdrawRequest,
} from "../../signableRequest/testing/builders/builders"
import type { FakeUser } from "../fakeApi/types"
import type {
  ApprovalProps,
  FakeUserOfProps,
  GasPaymentProps,
  LogCollector,
  LoggedLine,
  MatchesProps,
  ManualTimers,
  RequestProps,
  TransferProps,
  WaitForProps,
} from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

/** A user with Main and one open sub-account, as the service lists them. */
function fakeUserOf({ id, address, subAddress }: FakeUserOfProps): FakeUser {
  return {
    id,
    address,
    accounts: [
      { id: `${id}-main`, name: "Main", kind: AccountKind.MAIN, slot: null, address, state: AccountState.OPEN, active: true },
      {
        id: `${id}-sub-1`,
        name: "Sub-account 1",
        kind: AccountKind.SUB,
        slot: 1,
        address: subAddress,
        state: AccountState.OPEN,
        active: false,
      },
    ],
  }
}

/** A request of Main's as the banner reads it. */
function requestOf({
  id,
  accountId,
  kind = SignatureRequestKind.VENUE_SETUP,
  venue = VenueId.HYPERLIQUID,
  typedData,
  message,
  gas,
  depositVenue,
  state = SignatureRequestState.WAITING,
  createdAt = Date.now(),
  expiresAt = createdAt + DAY_MS,
}: RequestProps): SignatureRequestView {
  return {
    id,
    accountId,
    accountName: "Main",
    kind,
    reason: SignatureRequestReason.SETUP,
    venue,
    subject: "A subject the service wrote",
    why: null,
    consequence: "What happens without it",
    deadline: null,
    expiresAt: new Date(expiresAt).toISOString(),
    createdAt: new Date(createdAt).toISOString(),
    state,
    deferredUntil: null,
    signerDeclined: null,
    payload:
      message === undefined
        ? {
            kind: SignaturePayloadKind.TYPED_DATA,
            typedData: wire({ typedData }),
            ...(gas === undefined ? {} : { gas }),
            ...(depositVenue === undefined ? {} : { depositVenue }),
          }
        : { kind: SignaturePayloadKind.PERSONAL_MESSAGE, message },
  }
}

/** lebroker's Hyperliquid agent, approved for 180 days on Arbitrum: a setup the allowlist signs. */
function approvalRequest({ id, accountId, agent, askedAt = Date.now() }: ApprovalProps): SignatureRequestView {
  const typedData = hyperliquidApproveAgentRequest({
    agentAddress: agent,
    name: HYPERLIQUID_AGENT_NAME,
    validUntil: askedAt + 180 * DAY_MS,
    nonce: askedAt,
    network: Network.MAINNET,
    signatureChainId: 42161,
  }).typedData
  return requestOf({ id, accountId, typedData, createdAt: askedAt })
}

/** A Hyperliquid transfer of Main's USDC to an address, on Arbitrum. */
function transferRequest({ id, accountId, destination, askedAt = Date.now() }: TransferProps): SignatureRequestView {
  const typedData = hyperliquidSendAssetRequest({
    destination,
    sourceDex: HYPERLIQUID_SEND_DEX,
    destinationDex: HYPERLIQUID_SEND_DEX,
    token: HYPERLIQUID_USDC,
    amount: 25,
    nonce: askedAt,
    network: Network.MAINNET,
    signatureChainId: 42161,
  }).typedData
  return requestOf({ id, accountId, kind: SignatureRequestKind.TRANSFER, typedData, createdAt: askedAt })
}

/** Main's payment of $0.15 to lebroker's dev gas reserve, for gas on Arbitrum, as the executor's gas purchase asks it. */
function gasPaymentRequest({ id, accountId, askedAt = Date.now() }: GasPaymentProps): SignatureRequestView {
  const typedData = hyperliquidSendAssetRequest({
    destination: DEV_GAS_RESERVE,
    sourceDex: HYPERLIQUID_SEND_DEX,
    destinationDex: HYPERLIQUID_SEND_DEX,
    token: HYPERLIQUID_USDC,
    amount: 0.15,
    nonce: askedAt,
    network: Network.MAINNET,
    signatureChainId: 42161,
  }).typedData
  return requestOf({ id, accountId, kind: SignatureRequestKind.GAS_PURCHASE, typedData, gas: { chainId: 42161 }, createdAt: askedAt })
}

/** Main's Hyperliquid withdrawal of 6 USDC on Arbitrum, said to pay Main's own Lighter intent address (D49). */
function lighterWithdrawalRequest({ id, accountId, destination, askedAt = Date.now() }: TransferProps): SignatureRequestView {
  const typedData = hyperliquidWithdrawRequest({
    destination,
    amount: 6,
    time: askedAt,
    network: Network.MAINNET,
    signatureChainId: 42161,
  }).typedData
  return requestOf({
    id,
    accountId,
    kind: SignatureRequestKind.WITHDRAWAL,
    typedData,
    depositVenue: VenueId.LIGHTER,
    createdAt: askedAt,
  })
}

function logCollector(): LogCollector {
  const lines: string[] = []
  const waiting: { props: WaitForProps; resolve: () => void }[] = []
  function matches({ line, props }: MatchesProps): boolean {
    return line.event === props.event && (props.stage === undefined || line.stage === props.stage)
  }
  function parse(line: string): LoggedLine {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === "object" && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {}
  }
  const log = createLogger({
    write: line => {
      lines.push(line)
      const read = parse(line)
      for (const entry of waiting.filter(own => matches({ line: read, props: own.props }))) {
        waiting.splice(waiting.indexOf(entry), 1)
        entry.resolve()
      }
    },
  })
  return {
    log,
    lines,
    read: () => lines.map(parse),
    waitFor: props =>
      new Promise(resolve => {
        if (lines.map(parse).some(line => matches({ line, props }))) {
          resolve()
          return
        }
        waiting.push({ props, resolve })
      }),
  }
}

function manualTimers(): ManualTimers {
  const runs = new Set<() => void>()
  return {
    every: ({ run }) => {
      runs.add(run)
      return () => runs.delete(run)
    },
    sleep: ({ signal }) =>
      new Promise(resolve => {
        if (signal.aborted) {
          resolve()
          return
        }
        signal.addEventListener("abort", () => resolve())
      }),
    tick: () => {
      for (const run of runs) {
        run()
      }
    },
  }
}

export { approvalRequest, fakeUserOf, gasPaymentRequest, lighterWithdrawalRequest, logCollector, manualTimers, requestOf, transferRequest }
