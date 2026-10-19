/**
 * Lighter's registration message, as lighter-go writes it for `ChangePubKey`: the key, then the nonce, the account
 * index and the API key index as `0x` and 16 hex digits.
 */
const REGISTRATION_MESSAGE =
  /^Register Lighter Account\n\npubkey: (0x[0-9a-f]{80})\nnonce: 0x[0-9a-f]{16}\naccount index: 0x([0-9a-f]{16})\napi key index: 0x([0-9a-f]{16})\nOnly sign this message for a trusted client!$/

export { REGISTRATION_MESSAGE }
