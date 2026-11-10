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
/** A sub-account another user shares with the user, open; its owner's Main; and one shared with them but closed. */
const SHARED_SUB: Address = "0x7777777777777777777777777777777777777777"
const OWNER: Address = "0x8888888888888888888888888888888888888888"
const CLOSED_SHARED_SUB: Address = "0x9999999999999999999999999999999999999999"
const USER_ID = "user-1"
const MAIN_ACCOUNT_ID = "account-main"

/** The deployment's Hyperliquid agent's name, as its settings give it: development's. */
const HYPERLIQUID_AGENT_NAME = "leneutre-dev"

/** The deployment's Aster trading agent's name, as its settings give it: development's. */
const ASTER_AGENT_NAME = "leneutre-dev"

/** LaMarge's production, as the executor names the deployment a LaMarge request is for. */
const LAMARGE_PRODUCTION = { appOrigin: "https://app.lamarge.trade" }

/** When the requests were asked: 19 October 2026, noon UTC. */
const ASKED_AT = Date.UTC(2026, 9, 19, 12)

const ACCOUNTS: SignableRequestProps["accounts"] = [
  { id: MAIN_ACCOUNT_ID, name: "Main", kind: AccountKind.MAIN, state: AccountState.OPEN, address: MAIN },
  { id: "account-sub-1", name: "Sub-account 1", kind: AccountKind.SUB, state: AccountState.OPEN, address: SUB },
  { id: "account-sub-2", name: "Sub-account 2", kind: AccountKind.SUB, state: AccountState.CLOSED, address: CLOSED_SUB },
]

/** The sub-accounts another user shares with the user, as the service lists them beside their own: one open, one closed. */
const SHARED: NonNullable<SignableRequestProps["shared"]> = [
  { id: "account-shared-1", name: "Hedges", kind: AccountKind.SUB, state: AccountState.OPEN, address: SHARED_SUB, ownerAddress: OWNER },
  {
    id: "account-shared-2",
    name: "Closed",
    kind: AccountKind.SUB,
    state: AccountState.CLOSED,
    address: CLOSED_SHARED_SUB,
    ownerAddress: OWNER,
  },
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
  send,
  deletes,
  step,
  depositVenue = null,
  depositAddress,
  approvedRecipients,
  shared = SHARED,
  askedAt = ASKED_AT,
  now = askedAt,
  main = MAIN,
}: RequestOfProps): SignableRequestProps {
  const named = {
    ...(take === undefined ? {} : { take }),
    ...(lamarge === null ? {} : { lamarge }),
    ...(step === undefined ? {} : { step }),
  }
  return {
    request: {
      kind: kind ?? SignatureRequestKind.VENUE_SETUP,
      reason,
      venue,
      accountId,
      createdAt: new Date(askedAt).toISOString(),
      payload:
        message === undefined
          ? {
              kind: SignaturePayloadKind.TYPED_DATA,
              typedData: wire({ typedData }),
              ...named,
              ...(send === undefined ? {} : { send }),
              ...(deletes === undefined ? {} : { deletes }),
              ...(depositVenue === null ? {} : { depositVenue }),
            }
          : {
              kind: SignaturePayloadKind.PERSONAL_MESSAGE,
              message,
              ...named,
              ...(depositVenue === null ? {} : { depositVenue }),
            },
    },
    user: { id: USER_ID, address: main },
    accounts: ACCOUNTS,
    shared,
    walletChainId,
    hyperliquidAgentName: HYPERLIQUID_AGENT_NAME,
    asterAgentName: ASTER_AGENT_NAME,
    ...(depositAddress === undefined ? {} : { depositAddress }),
    ...(approvedRecipients === undefined ? {} : { approvedRecipients }),
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
  ASTER_AGENT_NAME,
  CLOSED_SHARED_SUB,
  CLOSED_SUB,
  HYPERLIQUID_AGENT_NAME,
  LAMARGE_PRODUCTION,
  MAIN,
  MAIN_ACCOUNT_ID,
  OWNER,
  SHARED_SUB,
  STRANGER,
  SUB,
  USER_ID,
  registrationMessage,
  requestOf,
  wire,
}
