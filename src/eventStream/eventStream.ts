import { DEFAULT_EVENT, EVENT_BLOCK_END, EVENT_FIELD, LINE_END } from "./constants"
import type { EventNameProps, ReadEventsProps } from "./types"

/** A block's event name; null for a block of comments alone, such as the service's heartbeat. */
function eventName({ block }: EventNameProps): string | null {
  const lines = block.split(LINE_END).filter(line => line !== "" && !line.startsWith(":"))
  if (lines.length === 0) {
    return null
  }
  const named = lines.find(line => line.startsWith(EVENT_FIELD))
  return named === undefined ? DEFAULT_EVENT : named.slice(EVENT_FIELD.length).trim()
}

/**
 * Reads a server-sent event stream to its end, telling each event's name: the signer only needs to know something
 * changed, and reads the requests again itself. Ends when the stream does, or throws when it breaks.
 */
async function readEvents({ body, onEvent }: ReadEventsProps): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true })
    const blocks = buffer.split(EVENT_BLOCK_END)
    buffer = blocks.pop() ?? ""
    for (const block of blocks) {
      const name = eventName({ block })
      if (name !== null) {
        onEvent(name)
      }
    }
  }
}

export { readEvents }
