import { afterEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { addressBookMessage, parseAddressBookMessage } from "../lebroker/accounts/addressBookMessage/addressBookMessage"
import { AddressBookStatement } from "../lebroker/accounts/model"
import { openAddressBookRecord } from "./addressBookRecord"
import { AddressBookRecordError } from "./enums"
import type { EntryOfProps } from "./testing/types"

const MAIN = privateKeyToAccount(generatePrivateKey())
const OTHER = privateKeyToAccount(generatePrivateKey())
const SUB = privateKeyToAccount(generatePrivateKey()).address
const DEPLOYMENT = "lebroker.dev.lamarge.trade"

const files: string[] = []

afterEach(async () => {
  await Promise.all(files.splice(0).map(path => rm(path, { force: true })))
})

function fileOf(): string {
  const path = join(tmpdir(), `main-signer-record-${randomUUID()}.json`)
  files.push(path)
  return path
}

/** An entry signed by `signer`, Main by default, for `deployment`, checked as the signer checks it. */
async function entryOf({ signer = MAIN, statement = AddressBookStatement.APPROVE, deployment = DEPLOYMENT }: EntryOfProps = {}) {
  const message = addressBookMessage({
    statement,
    deployment,
    main: signer.address,
    recipients: [{ address: SUB, label: "Sub-account 1" }],
    at: Date.now(),
  })
  const content = parseAddressBookMessage({ message })
  if (content === null) {
    throw new Error("the entry reads back")
  }
  return { message, signature: await signer.signMessage({ message }), content }
}

describe("the address book's record (lebroker's D70)", () => {
  test("keeps what it's given across a restart, each Main's apart, and only this deployment's", async () => {
    const path = fileOf()
    const record = await openAddressBookRecord({ path, deployment: DEPLOYMENT })
    const approval = await entryOf()
    const withdrawal = await entryOf({ statement: AddressBookStatement.WITHDRAW })
    await record.keep({ entries: [approval, withdrawal, approval] })
    await record.keep({ entries: [await entryOf({ signer: OTHER })] })
    expect(record.statementsOf({ main: MAIN.address.toLowerCase() }).map(content => content.statement)).toEqual([
      AddressBookStatement.APPROVE,
      AddressBookStatement.WITHDRAW,
    ])
    const reopened = await openAddressBookRecord({ path, deployment: DEPLOYMENT })
    expect(reopened.statementsOf({ main: MAIN.address })).toEqual(record.statementsOf({ main: MAIN.address }))
    expect(reopened.statementsOf({ main: OTHER.address })).toHaveLength(1)
    // The same file, read for another deployment: none of it approves anything there.
    const elsewhere = await openAddressBookRecord({ path, deployment: "lebroker.lamarge.trade" })
    expect(elsewhere.statementsOf({ main: MAIN.address })).toEqual([])
  })

  test("reads back only entries Main's key signed: one changed in the file approves nothing", async () => {
    const path = fileOf()
    const approval = await entryOf()
    const forged = { message: approval.message.replace("Sub-account 1", "Sub-account 2"), signature: approval.signature }
    await writeFile(path, JSON.stringify({ entries: [forged] }))
    expect((await openAddressBookRecord({ path, deployment: DEPLOYMENT })).statementsOf({ main: MAIN.address })).toEqual([])
  })

  test("is empty before its file exists, and a file it didn't write stops the start", async () => {
    expect((await openAddressBookRecord({ path: fileOf(), deployment: DEPLOYMENT })).statementsOf({ main: MAIN.address })).toEqual([])
    for (const text of ["not json", JSON.stringify({ entries: [{ message: "x", signature: "not hex" }] }), "[]"]) {
      const path = fileOf()
      await writeFile(path, text)
      expect(openAddressBookRecord({ path, deployment: DEPLOYMENT })).rejects.toThrow(AddressBookRecordError.MALFORMED)
    }
  })
})
