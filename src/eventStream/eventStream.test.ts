import { describe, expect, test } from "bun:test"
import { readEvents } from "./eventStream"

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start: controller => {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe("readEvents", () => {
  test("tells each event's name, across chunks and line endings, heartbeats left out", async () => {
    const names: string[] = []
    await readEvents({
      body: streamOf([
        ": open\n\n",
        "event: signature-",
        'requests\ndata: {"type":"signature-requests"}\n\n',
        ": heartbeat\r\n\r\n",
        "event: market\r\ndata: {}\r\n\r\n",
        "data: unnamed\n\n",
        "event: cut-off",
      ]),
      onEvent: name => names.push(name),
    })
    expect(names).toEqual(["signature-requests", "market", "message"])
  })
})
