import type { CreateLoggerProps, Logger } from "./types"

/**
 * One JSON line per event: when, what, which wallet (label and address) and which request (id, kind, venue). Its
 * fields are words and numbers chosen by the caller; a key or a signature has no field to go in.
 */
function createLogger({ write = line => process.stdout.write(`${line}\n`), now = Date.now }: CreateLoggerProps = {}): Logger {
  return ({ event, wallet, request, fields }) => {
    write(
      JSON.stringify({
        time: new Date(now()).toISOString(),
        event,
        ...(wallet === undefined ? {} : { wallet: wallet.label, address: wallet.address }),
        ...(request === undefined ? {} : { requestId: request.id, kind: request.kind, venue: request.venue }),
        ...fields,
      }),
    )
  }
}

export { createLogger }
