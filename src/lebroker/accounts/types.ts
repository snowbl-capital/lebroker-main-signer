import type { VenueId } from "../core/model"
import type { SignaturePayloadKind } from "./enums"

/** EIP-712 typed data as a browser wallet's `eth_signTypedData_v4` takes it: integers as decimal strings. */
type TypedDataPayload = {
  domain: Record<string, unknown>
  types: Record<string, readonly { name: string; type: string }[]>
  primaryType: string
  message: Record<string, unknown>
}

/**
 * A take's terms as LaMarge's API answered them, in its own field names: what its SDK checks a take's payment against.
 * `max_fee_bps`: the highest taker fee it accepts, absent without consent, which then pays none.
 */
type LaMargeTakeInput = { from: string; to: string; amount_in: string; min_out: string; max_fee_bps?: number | undefined }

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
  /** The taker fee the fill carries, which its `swap_id` says too; absent from a server before fees. */
  taker_fee?: string | undefined
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

/** A Polymarket operation as LaMarge prepared it, its strings exactly as sent: what its typed data's `data` hashes. */
type LaMargeOp = { type: string; args: { account: string; token: string; amount: string; to: string } }

/**
 * A LaMarge send from Main to another of the user's accounts on the same venue, as the mover asked LaMarge for it:
 * the venue, by LaMarge's id, the recipient, the exact amount in the venue token's base units, and on Polymarket the
 * operation whose hash Main's wallet signs. The service's word: the signing side holds the recipient to the user's own
 * accounts, and rebuilds and checks what's signed against the rest (`checkSend`).
 */
type LaMargeSend = { venue: string; recipient: string; amount: string; op?: LaMargeOp | undefined }

/**
 * What a payment to lebroker's gas reserve buys: gas on this chain, sent to Main's own wallet once
 * paid. The service's word, for the summary: what's signed is the payment alone.
 */
type GasPurchaseContext = { chainId: number }

/**
 * What Main's wallet signs for a request; `take`, for a LaMarge take's payment inside a venue, the take it pays;
 * `lamarge`, for a LaMarge request, the deployment it's for; `send`, for a LaMarge send to another of the user's
 * accounts, its terms; `gas`, for a payment to lebroker's gas reserve, what it buys; `depositVenue`, for a withdrawal
 * paid straight into a venue's deposit address for Main, which opens Main's account
 * there, that venue: the signing side reads the address itself from the venue before it signs, never the request's word.
 */
type SignaturePayload =
  | {
      kind: SignaturePayloadKind.TYPED_DATA
      typedData: TypedDataPayload
      take?: LaMargeTake | undefined
      lamarge?: LaMargeRequestContext | undefined
      gas?: GasPurchaseContext | undefined
      depositVenue?: VenueId | undefined
      send?: LaMargeSend | undefined
    }
  | {
      kind: SignaturePayloadKind.PERSONAL_MESSAGE
      message: string
      take?: LaMargeTake | undefined
      lamarge?: LaMargeRequestContext | undefined
    }

export type {
  GasPurchaseContext,
  LaMargeLighterAccounts,
  LaMargeOp,
  LaMargeRequestContext,
  LaMargeSend,
  LaMargeTake,
  LaMargeTakeFill,
  LaMargeTakeInput,
  SignaturePayload,
  TypedDataPayload,
}
