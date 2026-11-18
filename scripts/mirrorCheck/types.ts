/**
 * A file copied from lebroker: `whole`, every declaration of the source is here too, or `part`, only some are. Either
 * way, each declaration here is the source's, word for word; only the imports differ. A file may gather declarations
 * lebroker keeps in several files: each is then found in one of `source`'s.
 */
type MirroredFile = { mirror: string; source: string | readonly string[]; whole: boolean }

type DeclarationsProps = { path: string; text: string }

type CompareProps = { file: MirroredFile; lebroker: string; root: string }

/** A top-level declaration as written, its doc comment included: where it lies, and how its file exports it. */
type Declared = { text: string; start: number; end: number; exported: "value" | "type" | null }

export type { CompareProps, Declared, DeclarationsProps, MirroredFile }
