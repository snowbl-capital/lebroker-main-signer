import { describe, expect, test } from "bun:test"
import { getAddress, parseSignature, recoverMessageAddress, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  addressBookMessage,
  approvedRecipientsOf,
  canonicalSignature,
  isAddressBookMessage,
  parseAddressBookMessage,
  verifiedAddressBookEntry,
} from "./addressBookMessage"
import { ADDRESS_BOOK_MAX_SKEW_MS, SECP256K1_ORDER } from "./constants"
import { AddressBookMessageError, AddressBookStatement } from "./enums"

const MAIN = privateKeyToAccount(generatePrivateKey())
const OTHER = privateKeyToAccount(generatePrivateKey())

/** Made-up sub-accounts, no key behind them, written in lower case as a server may give them. */
const SUB_1 = "0x2222222222222222222222222222222222222abc"
const SUB_2 = "0x3333333333333333333333333333333333333def"

const DEPLOYMENT = "lebroker.dev.lamarge.trade"

/** 25 October 2026, noon UTC. */
const AT = Date.UTC(2026, 9, 25, 12)

const ENTRY = {
  statement: AddressBookStatement.APPROVE,
  deployment: DEPLOYMENT,
  main: MAIN.address.toLowerCase(),
  recipients: [
    { address: SUB_1, label: "Sub-account 1" },
    { address: SUB_2, label: "Sub-account 2" },
  ],
  at: AT,
}

describe("Main's address-book entry", () => {
  test("names the app, the deployment, Main, each recipient's label and full checksummed address, and the date, as the wallet shows it", () => {
    expect(addressBookMessage(ENTRY)).toBe(
      [
        "lebroker address book",
        "",
        "Deployment: lebroker.dev.lamarge.trade",
        `Main: ${MAIN.address}`,
        "",
        "I approve these addresses as recipients of transfers from this Main:",
        `- Sub-account 1: ${getAddress(SUB_1)}`,
        `- Sub-account 2: ${getAddress(SUB_2)}`,
        "",
        "Date: 2026-10-25T12:00:00.000Z",
      ].join("\n"),
    )
  })

  test("withdraws an approval in the same form, its own line saying so", () => {
    const message = addressBookMessage({ ...ENTRY, statement: AddressBookStatement.WITHDRAW })
    expect(message.split("\n")[5]).toBe("I withdraw approval of these addresses as recipients of transfers from this Main:")
    expect(parseAddressBookMessage({ message })).toMatchObject({ statement: AddressBookStatement.WITHDRAW })
  })

  test("reads back what it writes, several recipients in one entry, checksummed whatever case they were asked in", () => {
    expect(parseAddressBookMessage({ message: addressBookMessage(ENTRY) })).toEqual({
      statement: AddressBookStatement.APPROVE,
      deployment: DEPLOYMENT,
      main: MAIN.address,
      recipients: [
        { address: getAddress(SUB_1), label: "Sub-account 1" },
        { address: getAddress(SUB_2), label: "Sub-account 2" },
      ],
      at: AT,
    })
  })

  test("reads nothing but its own form: an address in lower case, a line more or less, another date's form", () => {
    const message = addressBookMessage(ENTRY)
    for (const changed of [
      message.replace(getAddress(SUB_1), SUB_1),
      message.replace(MAIN.address, MAIN.address.toLowerCase()),
      `\n${message}`,
      message.replace("lebroker address book", "Lebroker address book"),
      message.replace("2026-10-25T12:00:00.000Z", "2026-10-25"),
      message.replace("- Sub-account 1", "Sub-account 1"),
      message.replace(`${getAddress(SUB_2)}\n\nDate`, `${getAddress(SUB_2)}\nDate`),
      message.replace("\n\nDeployment", "\nDeployment"),
      message.replace(`Deployment: ${DEPLOYMENT}\n`, ""),
      message.replace(DEPLOYMENT, "Lebroker.dev.lamarge.trade"),
      message.replace("I approve these", "I approved these"),
      message.replace(`- Sub-account 2: ${getAddress(SUB_2)}`, `- Sub-account 2: ${getAddress(SUB_1)}`),
      message.replace(`- Sub-account 2: ${getAddress(SUB_2)}`, `- Main: ${MAIN.address}`),
      message.replace("Sub-account 1", "Sub: account 1"),
    ]) {
      expect(parseAddressBookMessage({ message: changed })).toBeNull()
    }
  })

  test("reads no entry with Windows line ends, a new line after its date, or a label beyond its letters", () => {
    const message = addressBookMessage(ENTRY)
    expect(parseAddressBookMessage({ message: message.replaceAll("\n", "\r\n") })).toBeNull()
    expect(parseAddressBookMessage({ message: `${message}\n` })).toBeNull()
    expect(parseAddressBookMessage({ message: `${message}\r\n` })).toBeNull()
    for (const label of ["Sous-compte é", "Sub-account 1​", "Sub‐account 1", "Ѕub-account 1", "Sub-account 💰"]) {
      expect(parseAddressBookMessage({ message: message.replace("Sub-account 1", label) })).toBeNull()
      expect(() => addressBookMessage({ ...ENTRY, recipients: [{ address: SUB_1, label }] })).toThrow(AddressBookMessageError.LABEL)
    }
  })

  test("refuses to write an entry with no recipient, Main itself, an address twice, a label it can't show, or no address", () => {
    const cases: [Parameters<typeof addressBookMessage>[0], AddressBookMessageError][] = [
      [{ ...ENTRY, recipients: [] }, AddressBookMessageError.NO_RECIPIENT],
      [{ ...ENTRY, recipients: [{ address: MAIN.address, label: "Main" }] }, AddressBookMessageError.MAIN_ITSELF],
      [
        {
          ...ENTRY,
          recipients: [
            { address: SUB_1, label: "Sub-account 1" },
            { address: getAddress(SUB_1), label: "Again" },
          ],
        },
        AddressBookMessageError.TWICE,
      ],
      [{ ...ENTRY, recipients: [{ address: SUB_1, label: "Sub\naccount" }] }, AddressBookMessageError.LABEL],
      [{ ...ENTRY, recipients: [{ address: SUB_1, label: " Sub" }] }, AddressBookMessageError.LABEL],
      [{ ...ENTRY, recipients: [{ address: SUB_1, label: "x".repeat(65) }] }, AddressBookMessageError.LABEL],
      [{ ...ENTRY, recipients: [{ address: "0x1234", label: "Short" }] }, AddressBookMessageError.NOT_AN_ADDRESS],
      [
        {
          ...ENTRY,
          recipients: Array.from({ length: 21 }, (_, index) => ({
            address: `0x${(index + 1).toString(16).padStart(40, "0")}`,
            label: `Sub ${index}`,
          })),
        },
        AddressBookMessageError.TOO_MANY,
      ],
      [{ ...ENTRY, at: Number.NaN }, AddressBookMessageError.DATE],
      [{ ...ENTRY, deployment: "https://lebroker.dev.lamarge.trade" }, AddressBookMessageError.DEPLOYMENT],
      [{ ...ENTRY, deployment: "Lebroker.dev.lamarge.trade" }, AddressBookMessageError.DEPLOYMENT],
      [{ ...ENTRY, deployment: "" }, AddressBookMessageError.DEPLOYMENT],
    ]
    for (const [asked, error] of cases) {
      expect(() => addressBookMessage(asked)).toThrow(error)
    }
  })

  test("is verified only when Main's own key signed it and it names that very Main and deployment, whatever case the reader gives Main in", async () => {
    const message = addressBookMessage(ENTRY)
    const signature = await MAIN.signMessage({ message })
    const reader = { main: MAIN.address.toLowerCase(), deployment: DEPLOYMENT }
    expect(await verifiedAddressBookEntry({ ...reader, message, signature })).toMatchObject({ main: MAIN.address })
    // Another key's signature over Main's entry, and Main's signature presented for another Main.
    expect(await verifiedAddressBookEntry({ ...reader, message, signature: await OTHER.signMessage({ message }) })).toBeNull()
    expect(await verifiedAddressBookEntry({ ...reader, main: OTHER.address, message, signature })).toBeNull()
    // Main's own entry for another deployment: signed on dev, never read on production.
    expect(await verifiedAddressBookEntry({ ...reader, deployment: "lebroker.lamarge.trade", message, signature })).toBeNull()
    // Another Main's own entry, signed by that Main: never Main's.
    const others = addressBookMessage({ ...ENTRY, main: OTHER.address })
    expect(
      await verifiedAddressBookEntry({ ...reader, message: others, signature: await OTHER.signMessage({ message: others }) }),
    ).toBeNull()
    // A recipient changed after the signature, and a signature that isn't one.
    const changed = message.replace(getAddress(SUB_2), getAddress("0x4444444444444444444444444444444444444444"))
    expect(await verifiedAddressBookEntry({ ...reader, message: changed, signature })).toBeNull()
    expect(await verifiedAddressBookEntry({ ...reader, message, signature: "0x1234" })).toBeNull()
  })

  test("is told apart from any other text, wherever it sits in one", () => {
    const message = addressBookMessage(ENTRY)
    expect(isAddressBookMessage({ message })).toBe(true)
    expect(isAddressBookMessage({ message: `Sign this\n\n${message}` })).toBe(true)
    expect(isAddressBookMessage({ message: "Register Lighter Account" })).toBe(false)
  })
})

describe("the recipients approved now", () => {
  const approve = { statement: AddressBookStatement.APPROVE, recipients: [{ address: SUB_1, label: "Sub-account 1" }] }
  const withdraw = { ...approve, statement: AddressBookStatement.WITHDRAW }

  test("for each address, the latest dated entry holds, whatever order they're listed in", () => {
    expect(approvedRecipientsOf({ now: AT, statements: [{ ...approve, at: AT }] })).toEqual([
      { address: SUB_1, label: "Sub-account 1", at: AT },
    ])
    expect(
      approvedRecipientsOf({
        now: AT,
        statements: [
          { ...approve, at: AT },
          { ...withdraw, at: AT + 1 },
        ],
      }),
    ).toEqual([])
    expect(
      approvedRecipientsOf({
        now: AT,
        statements: [
          { ...withdraw, at: AT + 1 },
          { ...approve, at: AT },
        ],
      }),
    ).toEqual([])
    expect(
      approvedRecipientsOf({
        now: AT,
        statements: [
          { ...withdraw, at: AT },
          { ...approve, at: AT + 1 },
        ],
      }),
    ).toHaveLength(1)
  })

  test("a withdrawal dated as an approval holds over it, and an address is matched whatever its case", () => {
    expect(
      approvedRecipientsOf({
        now: AT,
        statements: [
          { ...approve, at: AT },
          { ...withdraw, at: AT },
        ],
      }),
    ).toEqual([])
    const upper = { ...withdraw, recipients: [{ address: getAddress(SUB_1), label: "Sub-account 1" }], at: AT + 1 }
    expect(approvedRecipientsOf({ now: AT, statements: [{ ...approve, at: AT }, upper] })).toEqual([])
  })

  test("an entry dated past the reader's clock by more than the skew says nothing: a 2100 approval never holds over a later withdrawal", () => {
    const far = { ...approve, at: Date.UTC(2100, 0, 1) }
    expect(approvedRecipientsOf({ now: AT, statements: [far] })).toEqual([])
    expect(approvedRecipientsOf({ now: AT + 2, statements: [{ ...approve, at: AT }, far, { ...withdraw, at: AT + 1 }] })).toEqual([])
    // An entry dated up to the skew past the reader's clock still counts: clocks a few minutes apart agree.
    const soon = { ...approve, at: AT + ADDRESS_BOOK_MAX_SKEW_MS }
    expect(approvedRecipientsOf({ now: AT, statements: [soon] })).toHaveLength(1)
    expect(approvedRecipientsOf({ now: AT - 1, statements: [soon] })).toEqual([])
  })

  test("a withdrawal of one address leaves the others its approval named", () => {
    const both = { ...approve, recipients: [...approve.recipients, { address: SUB_2, label: "Sub-account 2" }], at: AT }
    expect(approvedRecipientsOf({ now: AT, statements: [both, { ...withdraw, at: AT + 1 }] })).toEqual([
      { address: SUB_2, label: "Sub-account 2", at: AT },
    ])
  })
})

describe("a signature's canonical encoding", () => {
  test("writes one signature one way: high s, v as 0 or 1, 64 bytes or upper case all read as the same", async () => {
    const message = addressBookMessage(ENTRY)
    const signature = await MAIN.signMessage({ message })
    const canonical = canonicalSignature({ signature })
    expect(canonical).toBe(signature)
    const parts = parseSignature(signature)
    const r = parts.r.slice(2)
    const s = BigInt(parts.s)
    const bit = parts.yParity
    const highS = (SECP256K1_ORDER - s).toString(16).padStart(64, "0")
    const compactS = ((BigInt(bit) << 255n) | s).toString(16).padStart(64, "0")
    const encodings: Hex[] = [
      `0x${r}${highS}${(28 - bit).toString(16)}`,
      `0x${r}${parts.s.slice(2)}0${String(bit)}`,
      `0x${r}${compactS}`,
      `0x${signature.slice(2).toUpperCase()}`,
    ]
    for (const encoding of encodings) {
      expect(canonicalSignature({ signature: encoding })).toBe(canonical)
    }
    // Each still recovers to Main, so each would verify: only the canonical one is kept.
    expect(await recoverMessageAddress({ message, signature: encodings[0] ?? "0x" })).toBe(MAIN.address)
  })

  test("is none for what isn't an ECDSA signature", () => {
    for (const signature of ["0x1234", "not hex", `0x${"00".repeat(65)}`, `0x${"ab".repeat(64)}1d`, `0x${"ff".repeat(65)}`]) {
      expect(canonicalSignature({ signature })).toBeNull()
    }
  })
})
