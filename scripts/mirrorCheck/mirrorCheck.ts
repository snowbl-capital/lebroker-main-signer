// Checks the code this repository copies from lebroker against a lebroker checkout: each declaration copied (a
// function, a constant, an enum, a type) must read word for word as its source's, imports and exports aside, and a
// file copied whole must leave none of its source's out. `bun run mirror:check <path to a lebroker checkout>`.
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import ts from "typescript"
import { MIRRORED_FILES } from "./constants"
import type { CompareProps, DeclarationsProps } from "./types"

/** A file's top-level declarations by name, as written, its imports and exports left out. */
function declarations({ path, text }: DeclarationsProps): Map<string, string> {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const found = new Map<string, string>()
  // A statement that names nothing, such as a test's `describe`, goes by its rank among those: imports shift lines.
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
    for (const name of names) {
      found.set(name, statement.getText(source))
    }
  }
  return found
}

async function compare({ file, lebroker, root }: CompareProps): Promise<string[]> {
  const source = await readFile(join(lebroker, file.source), "utf8").catch(() => null)
  if (source === null) {
    return [`${file.mirror}: its source ${file.source} is gone from lebroker`]
  }
  const ours = declarations({ path: file.mirror, text: await readFile(join(root, file.mirror), "utf8") })
  const theirs = declarations({ path: file.source, text: source })
  const problems: string[] = []
  for (const [name, text] of ours) {
    const there = theirs.get(name)
    if (there === undefined) {
      problems.push(`${file.mirror}: ${name} is no longer in ${file.source}`)
    } else if (there !== text) {
      problems.push(`${file.mirror}: ${name} differs from ${file.source}`)
    }
  }
  if (file.whole) {
    for (const name of theirs.keys()) {
      if (!ours.has(name)) {
        problems.push(`${file.mirror}: ${name} of ${file.source} is missing here`)
      }
    }
  }
  return problems
}

async function main(): Promise<void> {
  const target = process.argv[2]
  if (target === undefined) {
    process.stderr.write("Usage: bun run mirror:check <path to a lebroker checkout>\n")
    process.exit(2)
  }
  const root = resolve(import.meta.dir, "..", "..")
  const lebroker = resolve(target)
  const problems = (await Promise.all(MIRRORED_FILES.map(file => compare({ file, lebroker, root })))).flat()
  for (const problem of problems) {
    process.stdout.write(`${problem}\n`)
  }
  process.stdout.write(`${String(MIRRORED_FILES.length)} mirrored files checked, ${String(problems.length)} differences.\n`)
  process.exit(problems.length === 0 ? 0 : 1)
}

await main()
