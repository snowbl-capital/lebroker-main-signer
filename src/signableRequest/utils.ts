import { ESCROW_DEPLOYMENTS, type DeploymentManifest, type TakeFill } from "@lamarge/sdk/protocol"
import { AccountKind, AccountState } from "../lebroker/accounts/model"
import { shortAddress } from "../lebroker/core/model"
import { formatDate } from "../helpers/formatDate/formatDate"
import { sameAddress } from "../lebroker/web/helpers/sameAddress/sameAddress"
import { sharedAccountName } from "../lebroker/web/helpers/sharedAccountName/sharedAccountName"
import { SignableRefusal, SignSummaryText } from "./enums"
import { NotSignable } from "./errors"
import type {
  AllowedChainProps,
  AmountProps,
  ApprovalsProps,
  AtMostProps,
  ChainOfProps,
  DeploymentEscrowsProps,
  ExpectedDomainProps,
  ExpectedTypesProps,
  FeeNamedFillsProps,
  HexIndexProps,
  LaMargeCheckProps,
  QueryFieldsProps,
  RecipientSubAccountProps,
  RefuseProps,
  RuleAccount,
  SameAddressProps,
  SameDomainValueProps,
  SignSummary,
  SteppedProps,
  ToAccountProps,
  UntilProps,
  ValueProps,
} from "./types"

function refuse({ refusal }: RefuseProps): never {
  throw new NotSignable({ refusal })
}

/** Whether a value is an address equal to another, whatever their case. */
function isAddress({ address, other }: SameAddressProps): boolean {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address) && sameAddress({ address, other })
}

/** A value of the domain as it was written: a number for a chain id, written as a number or its decimal string. */
function sameDomainValue({ value, expected }: SameDomainValueProps): boolean {
  if (typeof expected === "number") {
    return (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && Number(value) === expected
  }
  if (typeof expected === "string" && /^0x[0-9a-fA-F]{40}$/.test(expected)) {
    return isAddress({ address: value, other: expected })
  }
  return value === expected
}

/** The domain is exactly the expected one: the same fields, none more, each with its value. */
function expectDomain({ typedData, domain }: ExpectedDomainProps): void {
  const names = Object.keys(typedData.domain).sort()
  const expected = Object.keys(domain).sort()
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  if (!expected.every(name => sameDomainValue({ value: typedData.domain[name], expected: domain[name] }))) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
}

/**
 * The types are exactly the expected ones, field for field and in their order, the primary type is the expected one,
 * and the message carries its fields and none more: nothing a wallet would hash differently from what's shown.
 */
function expectTypes({ typedData, types, primaryType }: ExpectedTypesProps): void {
  const own = Object.entries(typedData.types).filter(entry => entry[0] !== "EIP712Domain")
  const expected = Object.entries(types)
  const same =
    typedData.primaryType === primaryType &&
    own.length === expected.length &&
    expected.every(entry => JSON.stringify(typedData.types[entry[0]]) === JSON.stringify(entry[1]))
  const fields = (types[primaryType] ?? []).map(field => field.name).sort()
  const keys = Object.keys(typedData.message).sort()
  if (!same || fields.length !== keys.length || fields.some((name, index) => name !== keys[index])) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
}

/** A query string's parameters, exactly these names in this order, each once: Aster signs the query as written. */
function queryFields({ query, names }: QueryFieldsProps): Record<string, string> {
  const entries = [...new URLSearchParams(query).entries()]
  if (entries.length !== names.length || entries.some((entry, index) => entry[0] !== names[index])) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return Object.fromEntries(entries)
}

/**
 * The open sub-account at an address funds from Main may go to: one of the user's own, or one shared with them, as
 * the service lists them, and, where the signing side reads Main's address book, only one an entry signed by Main's
 * own key approves. Every rule that sends from Main to another account passes here.
 */
function recipientSubAccount({ address, accounts }: RecipientSubAccountProps) {
  const account =
    accounts.find(
      listed =>
        listed.kind === AccountKind.SUB &&
        listed.state === AccountState.OPEN &&
        listed.address !== null &&
        isAddress({ address, other: listed.address }),
    ) ?? refuse({ refusal: SignableRefusal.NOT_YOUR_ACCOUNT })
  if (!account.approved) {
    refuse({ refusal: SignableRefusal.NOT_IN_ADDRESS_BOOK })
  }
  return account
}

/**
 * The accounts funds from Main may go to, each with whether they may: the user's own, then the sub-accounts shared
 * with them, each named with its owner; approved, every one where no address book is read, as in the browser, only
 * those whose address an approved recipient names otherwise. Set here, whatever the accounts said before.
 */
function withApprovals({ accounts, shared = [], approvedRecipients }: ApprovalsProps): RuleAccount[] {
  const listed = [...accounts, ...shared.map(account => ({ ...account, name: sharedAccountName({ account }) }))]
  return listed.map(account => ({
    ...account,
    approved: approvedRecipients === undefined || approvedRecipients.some(other => isAddress({ address: account.address, other })),
  }))
}

/** The chain a typed message is signed on, as its domain names it. */
function chainOf({ typedData }: ChainOfProps): number {
  const chainId = typedData.domain.chainId
  if ((typeof chainId === "number" && Number.isSafeInteger(chainId)) || (typeof chainId === "string" && /^\d{1,15}$/.test(chainId))) {
    return Number(chainId)
  }
  return refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
}

/** The chain is one the request's kind may be signed on: never one the service chose freely. */
function allowedChain({ chainId, allowed }: AllowedChainProps): number {
  return allowed.includes(chainId) ? chainId : refuse({ refusal: SignableRefusal.UNKNOWN_CHAIN })
}

/** A whole number of a message, written as a number or its decimal string. */
function wholeNumber({ value }: ValueProps): number {
  if ((typeof value === "number" && Number.isSafeInteger(value) && value >= 0) || (typeof value === "string" && /^\d{1,16}$/.test(value))) {
    return Number(value)
  }
  return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
}

function text({ value }: ValueProps): string {
  return typeof value === "string" ? value : refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
}

function atMost({ value, max }: AtMostProps): void {
  if (value > max) {
    refuse({ refusal: SignableRefusal.TOO_LONG })
  }
}

/** A time in milliseconds, as the summary shows it. */
function until({ ms }: UntilProps): string {
  return formatDate({ iso: new Date(ms).toISOString() })
}

/** A decimal amount as a venue writes it, with its token: what the summary shows. */
function amount({ value, symbol }: AmountProps): string {
  if (typeof value !== "string" || !/^\d{1,18}(\.\d{1,18})?$/.test(value)) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return `${value} ${symbol}`
}

/** An index or a nonce of a Lighter message, written in hex: a whole number a wallet reads exactly, or refused. */
function hexIndex({ hex }: HexIndexProps): number {
  const value = Number.parseInt(hex ?? "", 16)
  return Number.isSafeInteger(value) ? value : refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
}

/** An account funds go to, by its name and short address. */
function toAccount({ account }: ToAccountProps): string {
  return account.address === null ? account.name : `${account.name} (${shortAddress({ address: account.address })})`
}

/**
 * A LaMarge deployment's own escrows, as LaMarge's SDK reviews them: its reviewed deployments of every environment, held
 * to those the deployment pins. What a request for it may name as its escrow, never another environment's.
 */
function deploymentEscrows({ deployment }: DeploymentEscrowsProps): DeploymentManifest {
  return ESCROW_DEPLOYMENTS.filter(reviewed => deployment.escrows.some(address => sameAddress({ address, other: reviewed.address })))
}

/** A take's fills as LaMarge's SDK checks them, each naming its taker fee, which a request stored before fees lacks. */
function feeNamedFills({ take }: FeeNamedFillsProps): TakeFill[] {
  return take.fills.map(fill => ({ ...fill, taker_fee: fill.taker_fee ?? refuse({ refusal: SignableRefusal.NO_TAKER_FEE }) }))
}

/** Runs one of LaMarge's SDK checks: what it refuses is refused here, in our words only: the SDK's stay out of sight. */
function laMargeCheck<T>({ check }: LaMargeCheckProps<T>): T {
  try {
    return check()
  } catch (error) {
    // The SDK's own words stay out of the page the user reads; which check refused is for whoever looks at the console.
    console.warn(error)
    return refuse({ refusal: SignableRefusal.LAMARGE_CHECK })
  }
}

/**
 * A request's summary, its place said before what it does where it's one of a chain of signatures: "Step 2 of 8: …".
 * A place past the chain's last isn't one lebroker asks.
 */
function stepped({ summary, step }: SteppedProps): SignSummary {
  if (step === undefined) {
    return summary
  }
  if (step.index > step.total) {
    refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return { ...summary, action: `${SignSummaryText.STEP} ${step.index} ${SignSummaryText.STEP_OF} ${step.total}: ${summary.action}` }
}

export {
  allowedChain,
  amount,
  atMost,
  chainOf,
  deploymentEscrows,
  expectDomain,
  expectTypes,
  feeNamedFills,
  hexIndex,
  isAddress,
  laMargeCheck,
  recipientSubAccount,
  queryFields,
  refuse,
  stepped,
  text,
  toAccount,
  until,
  wholeNumber,
  withApprovals,
}
