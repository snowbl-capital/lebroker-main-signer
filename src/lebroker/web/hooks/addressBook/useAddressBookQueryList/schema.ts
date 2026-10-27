import { AddressBookStatement } from "../../../../accounts/model"
import { z } from "zod"

/**
 * One entry of the user's address book, as the service keeps it: the message Main signed in clear, its signature,
 * whether it approves its recipients or withdraws their approval, the deployment it names, and when. The service's
 * word only: the Main signer checks each signature itself.
 */
const addressBookEntry = z.object({
  id: z.string(),
  statement: z.enum(AddressBookStatement),
  deployment: z.string(),
  message: z.string(),
  signature: z.string(),
  recipients: z.array(z.object({ address: z.string(), label: z.string() })),
  signedAt: z.string(),
  addedAt: z.string(),
})

/** The user's entries, oldest first. */
const addressBookList = z.object({ entries: z.array(addressBookEntry) })

/** An entry as adding it answers. */
const addressBookAnswer = z.object({ entry: addressBookEntry })

export { addressBookAnswer, addressBookEntry, addressBookList }
