// Copies lebroker's declarations into this repository's mirrored files, as `mirror:check` compares them: each
// declaration that differs is replaced by its source's, word for word, and, in a file copied whole, each the source has
// and this one lacks is added before its exports, and exported as its source exports it. Imports are left as they are,
// to be fixed by hand. `bun scripts/mirrorCheck/mirrorSync.ts <path to a lebroker checkout> [name to keep ...]`: a
// declaration named after the checkout is this repository's own, left as it is.
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import ts from "typescript"
import { MIRRORED_FILES } from "./constants"
import type { Declared, DeclarationsProps } from "./types"

/** A file's top-level declarations by name, as `mirror:check` reads them, each with its doc comment and its export. */
function declared({ path, text }: DeclarationsProps): Map<string, Declared> {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const exported = new Map<string, "value" | "type">()
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        exported.set(element.name.text, statement.isTypeOnly || element.isTypeOnly ? "type" : "value")
      }
    }
  }
  const found = new Map<string, Declared>()
  let unnamed = 0
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      continue
    }
    const named =
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement)
        ? statement.name?.text
        : undefined
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map(declaration => declaration.name.getText(source))
      : named !== undefined
        ? [named]
        : [`<${ts.SyntaxKind[statement.kind]} #${String((unnamed += 1))}>`]
    // Its doc comment goes with it.
    const start = statement.getFullStart() + (statement.getFullText(source).length - statement.getFullText(source).trimStart().length)
    for (const name of names) {
      found.set(name, { text: text.slice(start, statement.getEnd()), start, end: statement.getEnd(), exported: exported.get(name) ?? null })
    }
  }
  return found
}

const lebroker = resolve(process.argv[2] ?? "")
const kept = new Set(process.argv.slice(3))
const root = resolve(import.meta.dir, "..", "..")
for (const file of MIRRORED_FILES) {
  const sources = typeof file.source === "string" ? [file.source] : file.source
  const theirs = new Map<string, Declared>()
  for (const path of sources) {
    const text = await readFile(join(lebroker, path), "utf8").catch(() => null)
    if (text !== null) {
      for (const [name, value] of declared({ path, text })) {
        if (!theirs.has(name)) {
          theirs.set(name, value)
        }
      }
    }
  }
  if (theirs.size === 0) {
    continue
  }
  const mirrorPath = join(root, file.mirror)
  let text = await readFile(mirrorPath, "utf8")
  const ours = declared({ path: file.mirror, text })
  // Replaced from the end, so earlier offsets hold.
  const replaced = [...ours.entries()]
    .filter(([name, value]) => !kept.has(name) && theirs.has(name) && theirs.get(name)?.text !== value.text)
    .sort((one, other) => other[1].start - one[1].start)
  const seen = new Set<number>()
  for (const [name, value] of replaced) {
    if (seen.has(value.start)) {
      continue
    }
    seen.add(value.start)
    text = text.slice(0, value.start) + (theirs.get(name)?.text ?? value.text) + text.slice(value.end)
  }
  const missing = file.whole ? [...theirs.entries()].filter(([name]) => !ours.has(name) && !name.startsWith("<")) : []
  if (missing.length > 0) {
    const added = missing.map(([, value]) => value.text).filter((value, index, all) => all.indexOf(value) === index)
    const exportAt = text.search(/^export /m)
    const at = exportAt === -1 ? text.length : exportAt
    text = `${text.slice(0, at)}${added.join("\n\n")}\n\n${text.slice(at)}`
    const values = missing.filter(([, value]) => value.exported === "value").map(([name]) => name)
    const types = missing.filter(([, value]) => value.exported === "type").map(([name]) => name)
    if (values.length > 0) {
      text = text.replace(/^export \{([^}]*)\}/m, (_, names: string) => `export {${names.replace(/[\s,]*$/, "")}, ${values.join(", ")} }`)
    }
    if (types.length > 0) {
      text = text.replace(
        /^export type \{([^}]*)\}/m,
        (_, names: string) => `export type {${names.replace(/[\s,]*$/, "")}, ${types.join(", ")} }`,
      )
    }
  }
  if (replaced.length > 0 || missing.length > 0) {
    await writeFile(mirrorPath, text)
    process.stdout.write(`${file.mirror}: ${String(replaced.length)} replaced, ${String(missing.length)} added\n`)
  }
}
