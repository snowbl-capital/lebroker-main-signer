/** The record's file name, in the key folder unless MAIN_ADDRESS_BOOK_FILE says otherwise. */
const ADDRESS_BOOK_RECORD_FILE = "address-book.json"

/** Read and written by its owner only, as the key files are: it holds no secret, but says whom Main sends funds to. */
const RECORD_FILE_MODE = 0o600

/** Where the file is written before it replaces the record, so a cut write never leaves half a record. */
const RECORD_TEMP_SUFFIX = ".tmp"

export { ADDRESS_BOOK_RECORD_FILE, RECORD_FILE_MODE, RECORD_TEMP_SUFFIX }
