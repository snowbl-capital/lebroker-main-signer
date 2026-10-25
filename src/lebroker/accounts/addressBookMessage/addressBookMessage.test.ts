import { describe, expect, test } from "bun:test"
import { getAddress } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { addressBookMessage, isAddressBookMessage, parseAddressBookMessage, verifiedAddressBookEntry } from "./addressBookMessage"
import { AddressBookMessageError } from "./enums"

const MAIN = privateKeyToAccount(generatePrivateKey())
const OTHER = privateKeyToAccount(generatePrivateKey())

/** Made-up sub-accounts, no key behind them, written in lower case as a server may give them. */
const SUB_1 = "0x2222222222222222222222222222222222222abc"
const SUB_2 = "0x3333333333333333333333333333333333333def"

/** 25 October 2026, noon UTC. */
const AT = Date.UTC(2026, 9, 25, 12)

const ENTRY = {
  main: MAIN.address.toLowerCase(),
  recipients: [
    { address: SUB_1, label: "Sub-account 1" },
    { address: SUB_2, label: "Sub-account 2" },
  ],
  at: AT,
}

describe("Main's address-book entry (D70)", () => {
  test("names the app, Main, each recipient's label and full checksummed address, and the date, as the wallet shows it", () => {
    expect(addressBookMessage(ENTRY)).toBe(
      [
        "lebroker address book",
        "",
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

  test("reads back what it writes, several recipients in one entry, checksummed whatever case they were asked in", () => {
    expect(parseAddressBookMessage({ message: addressBookMessage(ENTRY) })).toEqual({
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
      `${message}\n`,
      `\n${message}`,
      message.replace("lebroker address book", "Lebroker address book"),
      message.replace("2026-10-25T12:00:00.000Z", "2026-10-25"),
      message.replace("- Sub-account 1", "Sub-account 1"),
      message.replace(`${getAddress(SUB_2)}\n\nDate`, `${getAddress(SUB_2)}\nDate`),
      message.replace("\n\nMain", "\nMain"),
      message.replace(`- Sub-account 2: ${getAddress(SUB_2)}`, `- Sub-account 2: ${getAddress(SUB_1)}`),
      message.replace(`- Sub-account 2: ${getAddress(SUB_2)}`, `- Main: ${MAIN.address}`),
      message.replace("Sub-account 1", "Sub: account 1"),
    ]) {
      expect(parseAddressBookMessage({ message: changed })).toBeNull()
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
    ]
    for (const [asked, error] of cases) {
      expect(() => addressBookMessage(asked)).toThrow(error)
    }
  })

  test("is verified only when Main's own key signed it and it names that very Main, whatever case the reader gives Main in", async () => {
    const message = addressBookMessage(ENTRY)
    const signature = await MAIN.signMessage({ message })
    expect(await verifiedAddressBookEntry({ main: MAIN.address.toLowerCase(), message, signature })).toMatchObject({ main: MAIN.address })
    // Another key's signature over Main's entry, and Main's signature presented for another Main.
    expect(await verifiedAddressBookEntry({ main: MAIN.address, message, signature: await OTHER.signMessage({ message }) })).toBeNull()
    expect(await verifiedAddressBookEntry({ main: OTHER.address, message, signature })).toBeNull()
    // Another Main's own entry, signed by that Main: never Main's.
    const others = addressBookMessage({ ...ENTRY, main: OTHER.address })
    expect(
      await verifiedAddressBookEntry({ main: MAIN.address, message: others, signature: await OTHER.signMessage({ message: others }) }),
    ).toBeNull()
    // A recipient changed after the signature, and a signature that isn't one.
    const changed = message.replace(getAddress(SUB_2), getAddress("0x4444444444444444444444444444444444444444"))
    expect(await verifiedAddressBookEntry({ main: MAIN.address, message: changed, signature })).toBeNull()
    expect(await verifiedAddressBookEntry({ main: MAIN.address, message, signature: "0x1234" })).toBeNull()
  })

  test("is told apart from any other text, wherever it sits in one", () => {
    const message = addressBookMessage(ENTRY)
    expect(isAddressBookMessage({ message })).toBe(true)
    expect(isAddressBookMessage({ message: `Sign this\n\n${message}` })).toBe(true)
    expect(isAddressBookMessage({ message: "Register Lighter Account" })).toBe(false)
  })
})
