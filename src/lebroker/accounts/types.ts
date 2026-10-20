import type { SignaturePayloadKind } from "./enums"

/** EIP-712 typed data as a browser wallet's `eth_signTypedData_v4` takes it: integers as decimal strings. */
type TypedDataPayload = {
  domain: Record<string, unknown>
  types: Record<string, readonly { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
}

/** A take's terms as LaMarge's API answered them, in its own field names: what its SDK checks a take's payment against. */
type LaMargeTakeInput = { from: string; to: string; amount_in: string; min_out: string }

/** One fill of a take as LaMarge's API answered it: its maker's recipient, what it pays and delivers, and its windows. */
type LaMargeTakeFill = {
  id: string
  order_id: string
  sequence: number
  role: string
  from_venue: string
  to_venue: string
  amount_in: string
  amount_out: string
  payer: string
  maker_recipient: string
  taker_recipient: string
  swap_id: string
  hashlock: string
  pay_by: string
  t1: string
  t2: string
  delivery_to?: string | null | undefined
}

/**
 * The Lighter accounts a take's payment inside Lighter goes between, by index, as LaMarge's request named them: the
 * payer's, and the fill's maker recipient's, which the executor's SDK read on Lighter's public API before asking Main.
 */
type LaMargeLighterAccounts = { from_account_index: number; to_account_index: number }

/**
 * The LaMarge take a payment inside a venue settles, as LaMarge's API answered it: what the signature is checked
 * against, the maker's recipient it pays among it; `lighter`, for a payment inside Lighter, the accounts it goes
 * between. Only a take's payment carries it.
 */
type LaMargeTake = { input: LaMargeTakeInput; fills: LaMargeTakeFill[]; lighter?: LaMargeLighterAccounts | undefined }

/**
 * The LaMarge deployment a request is for, as the executor's mover works with it: its app's origin, which Main's
 * sign-in must name and whose Aster agent name an approval must carry; and, for the registration of LaMarge's key on
 * Lighter, Main's master account index as the executor read it on Lighter for Main's address.
 */
type LaMargeRequestContext = { appOrigin: string; lighterAccountIndex?: number | undefined }

/**
 * What Main's wallet signs for a request; `take`, for a LaMarge take's payment inside a venue, the take it pays;
 * `lamarge`, for a LaMarge request, the deployment it's for.
 */
type SignaturePayload =
  | {
      kind: SignaturePayloadKind.TYPED_DATA
      typedData: TypedDataPayload
      take?: LaMargeTake | undefined
      lamarge?: LaMargeRequestContext | undefined
    }
  | {
      kind: SignaturePayloadKind.PERSONAL_MESSAGE
      message: string
      take?: LaMargeTake | undefined
      lamarge?: LaMargeRequestContext | undefined
    }

export type {
  LaMargeLighterAccounts,
  LaMargeRequestContext,
  LaMargeTake,
  LaMargeTakeFill,
  LaMargeTakeInput,
  SignaturePayload,
  TypedDataPayload,
}
