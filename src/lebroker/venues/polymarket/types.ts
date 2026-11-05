import type { Address } from "viem"

/** A value of a command as it is signed: positional, an absent field `undefined`. */
type OpValue = boolean | number | string | undefined | readonly OpValue[]

type OpHashProps = { op: OpValue }

type CompactProps = { value: OpValue }

type OpTypedDataProps = { op: readonly OpValue[]; salt: number; ts: number }

type DeleteProxyOpProps = { proxy: Address }

export type { CompactProps, DeleteProxyOpProps, OpHashProps, OpTypedDataProps, OpValue }
