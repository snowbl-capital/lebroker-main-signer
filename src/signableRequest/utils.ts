import { ESCROW_DEPLOYMENTS, type DeploymentManifest } from "@lamarge/sdk/protocol"
import { AccountKind, AccountState } from "../lebroker/accounts/model"
import { isRecord, shortAddress } from "../lebroker/core/model"
import { formatDate } from "../helpers/formatDate/formatDate"
import { sameAddress } from "../lebroker/web/helpers/sameAddress/sameAddress"
import { GAS_RESERVE_DEPLOYMENTS } from "./constants"
import { SignableRefusal } from "./enums"
import { NotSignable } from "./errors"
import type {
  AllowedChainProps,
  AmountProps,
  ApprovalsProps,
  AppOriginProps,
  AtMostProps,
  ChainOfProps,
  DeploymentEscrowsProps,
  ExpectedDomainProps,
  ExpectedTypesProps,
  LaMargeCheckProps,
  OwnAccountProps,
  QueryFieldsProps,
  RefuseProps,
  RuleAccount,
  SameAddressProps,
  SameDomainValueProps,
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
 * The open sub-account of the user's at an address: funds from Main go to the user's own accounts only, and, where the
 * signing side reads Main's address book, to one an entry signed by Main's own key approves (D70). Every rule that
 * sends from Main to another account passes here.
 */
function ownSubAccount({ address, accounts }: OwnAccountProps) {
  const account =
    accounts.find(
      own =>
        own.kind === AccountKind.SUB &&
        own.state === AccountState.OPEN &&
        own.address !== null &&
        isAddress({ address, other: own.address }),
    ) ?? refuse({ refusal: SignableRefusal.NOT_YOUR_ACCOUNT })
  if (!account.approved) {
    refuse({ refusal: SignableRefusal.NOT_IN_ADDRESS_BOOK })
  }
  return account
}

/**
 * The user's accounts, each with whether funds from Main may go to it (D70): every one where no address book is read,
 * as in the browser, only those whose address an approved recipient names otherwise. Set here, whatever the accounts
 * said before.
 */
function withApprovals({ accounts, approvedRecipients }: ApprovalsProps): RuleAccount[] {
  return accounts.map(account => ({
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

/** A record of a decoded value, or a refusal. */
function recordOf({ value }: ValueProps): Record<string, unknown> {
  return isRecord(value) ? value : refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
}

/** A decimal amount as a venue writes it, with its token: what the summary shows. */
function amount({ value, symbol }: AmountProps): string {
  if (typeof value !== "string" || !/^\d{1,18}(\.\d{1,18})?$/.test(value)) {
    return refuse({ refusal: SignableRefusal.UNKNOWN_SHAPE })
  }
  return `${value} ${symbol}`
}

/** An account funds go to, by its name and short address. */
function toAccount({ account }: ToAccountProps): string {
  return account.address === null ? account.name : `${account.name} (${shortAddress({ address: account.address })})`
}

/** lebroker's gas reserve the deployment at this origin pins (D51, phase 6); null where it pins none. */
function pinnedGasReserve({ appOrigin }: AppOriginProps): string | null {
  return GAS_RESERVE_DEPLOYMENTS.find(pin => pin.appOrigin === appOrigin)?.reserve ?? null
}

/**
 * A LaMarge deployment's own escrows, as LaMarge's SDK reviews them: its reviewed deployments of every environment, held
 * to those the deployment pins. What a request for it may name as its escrow, never another environment's.
 */
function deploymentEscrows({ deployment }: DeploymentEscrowsProps): DeploymentManifest {
  return ESCROW_DEPLOYMENTS.filter(reviewed => deployment.escrows.some(address => sameAddress({ address, other: reviewed.address })))
}

/** Runs one of LaMarge's SDK checks: what it refuses is refused here, in its words after ours. */
function laMargeCheck<T>({ check }: LaMargeCheckProps<T>): T {
  try {
    return check()
  } catch (error) {
    return refuse({ refusal: `${SignableRefusal.LAMARGE_CHECK} ${error instanceof Error ? error.message : String(error)}` })
  }
}

export {
  allowedChain,
  amount,
  atMost,
  chainOf,
  deploymentEscrows,
  expectDomain,
  expectTypes,
  isAddress,
  laMargeCheck,
  ownSubAccount,
  pinnedGasReserve,
  queryFields,
  recordOf,
  refuse,
  text,
  toAccount,
  until,
  wholeNumber,
  withApprovals,
}
