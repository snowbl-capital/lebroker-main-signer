import { z } from "zod"
import { BybitDepositState } from "./enums"

/**
 * Main's own `MainBybitDepositAddress` signature, with what it signed, nonce and deadline as decimal strings: Main's
 * wallet checks it recovers Main before it takes the address.
 */
const signedBybitDeposit = z.object({
  owner: z.string(),
  account: z.string(),
  main: z.string(),
  depositAddress: z.string(),
  chainId: z.number(),
  nonce: z.string().regex(/^\d{1,78}$/),
  deadline: z.string().regex(/^\d{1,78}$/),
  signature: z.string(),
  signedAt: z.string(),
})

/**
 * Main's USDC deposit address on Bybit as its setup shows it: where it stands, its chain, the address Bybit shows now
 * (null unread), and Main's signature of the one it signed (null before).
 */
const bybitDepositView = z.object({
  state: z.enum(BybitDepositState),
  chainId: z.number(),
  read: z.string().nullable(),
  signed: signedBybitDeposit.nullable(),
})

const bybitDepositAnswer = z.object({ deposit: bybitDepositView })

export { signedBybitDeposit, bybitDepositView, bybitDepositAnswer }
