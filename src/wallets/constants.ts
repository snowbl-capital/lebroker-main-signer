/** A wallet's label: its key file's name. */
const WALLET_LABEL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/** The longest a label is: a malformed one is said back in an error up to this long, and not at all past it. */
const MAX_LABEL_LENGTH = 32

/** A key file in MAIN_KEYS_DIR: `<label>.key`. Other files there are left alone. */
const KEY_FILE_EXTENSION = ".key"

/** 32 bytes in hex, with or without 0x. */
const PRIVATE_KEY_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/

/** The permission bits of a key file's group and others: any of them set, the key isn't its owner's alone. */
const SHARED_MODE_BITS = 0o077

/**
 * The systems whose permission bits say nothing of who reads a file. Windows keeps that in each file's access list:
 * the runtime reports every file there as 666, or 444 when read-only, so the check would refuse every key file.
 */
const PLATFORMS_WITHOUT_MODE_BITS: readonly NodeJS.Platform[] = ["win32"]

export { KEY_FILE_EXTENSION, MAX_LABEL_LENGTH, PLATFORMS_WITHOUT_MODE_BITS, PRIVATE_KEY_PATTERN, SHARED_MODE_BITS, WALLET_LABEL_PATTERN }
