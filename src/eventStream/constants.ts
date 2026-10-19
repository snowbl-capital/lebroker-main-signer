/** Server-sent events: blocks end with an empty line; a line ends with LF, CRLF or CR. */
const EVENT_BLOCK_END = /\r\n\r\n|\n\n|\r\r/

const LINE_END = /\r\n|\n|\r/

const EVENT_FIELD = "event:"

/** An event that names none is a `message`, as browsers read it. */
const DEFAULT_EVENT = "message"

export { DEFAULT_EVENT, EVENT_BLOCK_END, EVENT_FIELD, LINE_END }
