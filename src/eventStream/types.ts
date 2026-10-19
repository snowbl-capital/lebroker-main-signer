type ReadEventsProps = {
  body: ReadableStream<Uint8Array>
  /** Each event's name, as the service names it: `signature-requests`, `message` when it names none. */
  onEvent: (name: string) => void
}

type EventNameProps = { block: string }

export type { EventNameProps, ReadEventsProps }
