import { readFile, rename, writeFile } from "node:fs/promises"
import { parseAddressBookMessage, verifiedAddressBookEntry } from "../lebroker/accounts/addressBookMessage/addressBookMessage"
import type { AddressBookContent } from "../lebroker/accounts/addressBookMessage/types"
import { RECORD_FILE_MODE, RECORD_TEMP_SUFFIX } from "./constants"
import { AddressBookRecordError } from "./enums"
import { recordFile } from "./schema"
import type { AddressBookRecord, OpenAddressBookRecordProps, ReadRecordProps, SignedEntry, WriteRecordProps } from "./types"

/** The entries the file keeps; none before the first is kept. A file this signer didn't write stops the start. */
async function readRecord({ path }: ReadRecordProps): Promise<SignedEntry[]> {
  let text: string
  try {
    text = await readFile(path, "utf8")
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, "code") === "ENOENT") {
      return []
    }
    throw error
  }
  let read: unknown
  try {
    read = JSON.parse(text)
  } catch {
    throw new Error(AddressBookRecordError.MALFORMED)
  }
  const parsed = recordFile.safeParse(read)
  if (!parsed.success) {
    throw new Error(AddressBookRecordError.MALFORMED)
  }
  return parsed.data.entries
}

/** The whole record, written beside the file first, then put in its place: a cut write leaves the last one whole. */
async function writeRecord({ path, entries }: WriteRecordProps): Promise<void> {
  const temp = `${path}${RECORD_TEMP_SUFFIX}`
  await writeFile(temp, `${JSON.stringify({ entries }, null, 2)}\n`, { mode: RECORD_FILE_MODE })
  await rename(temp, path)
}

/**
 * Every address-book entry this machine checked itself (lebroker's D70), kept in a file across restarts: approvals
 * and withdrawals alike, each Main's own signature over its message, for this deployment. The service's list adds to
 * it and never takes from it, so a withdrawal the service later stops listing still holds over the older approval it
 * replays. The file holds messages and signatures, addresses only, no key; an entry read back from it is checked again,
 * and one for another deployment is kept in it but approves nothing here.
 */
async function openAddressBookRecord({ path, deployment }: OpenAddressBookRecordProps): Promise<AddressBookRecord> {
  const kept = await readRecord({ path })
  const messages = new Set(kept.map(entry => entry.message))
  const contents: AddressBookContent[] = []
  for (const entry of kept) {
    const main = parseAddressBookMessage({ message: entry.message })?.main
    const content =
      main === undefined ? null : await verifiedAddressBookEntry({ main, deployment, message: entry.message, signature: entry.signature })
    if (content !== null) {
      contents.push(content)
    }
  }
  // One write at a time, every wallet's signer sharing the record; one that failed is tried again on the next keep.
  let writing: Promise<void> = Promise.resolve()
  let unsaved = false
  return {
    keep: async ({ entries }) => {
      let added = false
      for (const entry of entries) {
        if (!messages.has(entry.message)) {
          messages.add(entry.message)
          kept.push({ message: entry.message, signature: entry.signature })
          contents.push(entry.content)
          added = true
        }
      }
      if (!added && !unsaved) {
        return
      }
      const snapshot = [...kept]
      writing = writing
        .catch(() => undefined)
        .then(async () => {
          await writeRecord({ path, entries: snapshot })
          unsaved = false
        })
        .catch((error: unknown) => {
          unsaved = true
          throw error
        })
      await writing
    },
    statementsOf: ({ main }) => contents.filter(content => content.main.toLowerCase() === main.toLowerCase()),
  }
}

export { openAddressBookRecord }
