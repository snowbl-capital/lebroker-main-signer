import {
  AccountKind,
  AccountState,
  SignatureRequestKind,
  SignatureRequestReason,
  SignaturePayloadKind,
  typedDataPayload,
} from "../../lebroker/accounts/model"
import type { Address } from "viem"
import type { SignableRequestProps } from "../types"
import type { RegistrationMessageProps, RequestOfProps, WiredTypedData, WireProps } from "./types"

const MAIN: Address = "0x1111111111111111111111111111111111111111"
const SUB: Address = "0x2222222222222222222222222222222222222222"
const CLOSED_SUB: Address = "0x3333333333333333333333333333333333333333"
const STRANGER: Address = "0x4444444444444444444444444444444444444444"
const AGENT: Address = "0x5555555555555555555555555555555555555555"
const USER_ID = "user-1"
const MAIN_ACCOUNT_ID = "account-main"

/** LaMarge's production, as the executor names the deployment a LaMarge request is for. */
const LAMARGE_PRODUCTION = { appOrigin: "https://app.lamarge.trade" }

/** lebroker's dev deployment, whose gas reserve the allowlist pins (D51, phase 6): the page the requests are signed on. */
const LEBROKER_DEV = "https://lebroker.dev.lamarge.trade"

/** lebroker's dev gas reserve, as its account process logged it. */
const DEV_GAS_RESERVE: Address = "0x4453CFBC9f590229396E6D70c7CA552F6dC87A1F"

/** When the requests were asked: 19 October 2026, noon UTC. */
const ASKED_AT = Date.UTC(2026, 9, 19, 12)

const ACCOUNTS: SignableRequestProps["accounts"] = [
  { id: MAIN_ACCOUNT_ID, name: "Main", kind: AccountKind.MAIN, state: AccountState.OPEN, address: MAIN },
  { id: "account-sub-1", name: "Sub-account 1", kind: AccountKind.SUB, state: AccountState.OPEN, address: SUB },
  { id: "account-sub-2", name: "Sub-account 2", kind: AccountKind.SUB, state: AccountState.CLOSED, address: CLOSED_SUB },
]

/** Typed data as the service sends it: every bigint as its decimal string, `EIP712Domain` left out (`wireTypedData`). */
function wire({ typedData }: WireProps): WiredTypedData {
  const read = typedDataPayload.parse(
    JSON.parse(JSON.stringify(typedData, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value))),
  )
  return {
    ...read,
    types: Object.fromEntries(
      Object.entries(read.types)
        .filter(entry => entry[0] !== "EIP712Domain")
        .map(entry => [entry[0], [...entry[1]]]),
    ),
  }
}

/** A request of Main's, as the banner reads it, with what the browser knows beside it. */
function requestOf({
  kind,
  venue = null,
  typedData,
  message,
  accountId = MAIN_ACCOUNT_ID,
  walletChainId = 42161,
  reason = SignatureRequestReason.MOVE,
  take,
  lamarge = LAMARGE_PRODUCTION,
  gas = null,
  askedAt = ASKED_AT,
  now = askedAt,
  main = MAIN,
  appOrigin = LEBROKER_DEV,
}: RequestOfProps): SignableRequestProps {
  const named = { ...(take === undefined ? {} : { take }), ...(lamarge === null ? {} : { lamarge }) }
  return {
    request: {
      kind: kind ?? SignatureRequestKind.VENUE_SETUP,
      reason,
      venue,
      accountId,
      createdAt: new Date(askedAt).toISOString(),
      payload:
        message === undefined
          ? { kind: SignaturePayloadKind.TYPED_DATA, typedData: wire({ typedData }), ...named, ...(gas === null ? {} : { gas }) }
          : { kind: SignaturePayloadKind.PERSONAL_MESSAGE, message, ...named },
    },
    user: { id: USER_ID, address: main },
    accounts: ACCOUNTS,
    walletChainId,
    appOrigin,
    now,
  }
}

/** Lighter's registration message, as lighter-go writes it, for a key at `apiKeyIndex` of account `accountIndex`. */
function registrationMessage({ accountIndex, apiKeyIndex }: RegistrationMessageProps): string {
  const hex = (value: number) => `0x${value.toString(16).padStart(16, "0")}`
  return `Register Lighter Account\n\npubkey: 0x${"ab".repeat(40)}\nnonce: ${hex(7)}\naccount index: ${hex(accountIndex)}\napi key index: ${hex(apiKeyIndex)}\nOnly sign this message for a trusted client!`
}

export {
  AGENT,
  ASKED_AT,
  CLOSED_SUB,
  DEV_GAS_RESERVE,
  LAMARGE_PRODUCTION,
  LEBROKER_DEV,
  MAIN,
  MAIN_ACCOUNT_ID,
  STRANGER,
  SUB,
  USER_ID,
  registrationMessage,
  requestOf,
  wire,
}
