/**
 * A file copied from lebroker: `whole`, every declaration of the source is here too, or `part`, only some are. Either
 * way, each declaration here is the source's, word for word; only the imports differ.
 */
type MirroredFile = { mirror: string; source: string; whole: boolean }

type DeclarationsProps = { path: string; text: string }

type CompareProps = { file: MirroredFile; lebroker: string; root: string }

export type { CompareProps, DeclarationsProps, MirroredFile }
