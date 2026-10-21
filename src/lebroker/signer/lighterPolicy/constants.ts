/**
 * Lighter's registration message, as lighter-go writes it for `ChangePubKey`: the key, then the nonce, the account
 * index and the API key index as `0x` and 16 hex digits.
 */
const REGISTRATION_MESSAGE =
  /^Register Lighter Account\n\npubkey: (0x[0-9a-f]{80})\nnonce: 0x[0-9a-f]{16}\naccount index: 0x([0-9a-f]{16})\napi key index: 0x([0-9a-f]{16})\nOnly sign this message for a trusted client!$/

/**
 * Lighter's owner message for a transfer, as LaMarge's SDK writes it (`transferMessage`): its nonce, the accounts it
 * goes from and to, its amount, fee and memo, each read; the routes, the key that signs it, its asset and Lighter's
 * chain only matched, then pinned by writing the message again.
 */
const TRANSFER_MESSAGE =
  /^Transfer\n\nnonce: 0x([0-9a-f]{16})\nfrom: 0x([0-9a-f]{16}) \(route 0x[0-9a-f]{16}\)\napi key: 0x[0-9a-f]{16}\nto: 0x([0-9a-f]{16}) \(route 0x[0-9a-f]{16}\)\nasset: 0x[0-9a-f]{16}\namount: 0x([0-9a-f]{16})\nfee: 0x([0-9a-f]{16})\nchainId: 0x[0-9a-f]{16}\nmemo: ([0-9a-f]{64})\nOnly sign this message for a trusted client!$/

export { REGISTRATION_MESSAGE, TRANSFER_MESSAGE }
