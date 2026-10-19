import tseslint from "typescript-eslint"
import { fileURLToPath } from "node:url"

// The code rules lebroker follows (its CONTRIBUTING.md, "Code conventions"), so code mirrored from it reads the same here.
const NO_BODY_DESTRUCTURING = {
  selector: "VariableDeclarator > ObjectPattern",
  message: "Read through the object instead of destructuring it into locals; destructure props in the signature only.",
}
const OBJECT_PARAMS = ["FunctionDeclaration", "FunctionExpression", "TSMethodSignature", "TSDeclareFunction"].map(node => ({
  selector: `${node}[params.length>1]`,
  message: "Take one object parameter typed `…Props`, not positional arguments.",
}))
const TYPES_IN_TYPES_FILE = ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].map(node => ({
  selector: `Program > ${node}, ExportNamedDeclaration > ${node}`,
  message: "Declare types in the folder's types.ts.",
}))
const ENUMS_IN_ENUMS_FILE = {
  selector: "TSEnumDeclaration",
  message: "Declare enums in the folder's enums.ts.",
}
const CODE = ["src/**/*.ts", "scripts/**/*.ts"]
const conventions = (...selectors) => ["error", NO_BODY_DESTRUCTURING, ...OBJECT_PARAMS, ...selectors]

export default [
  { ignores: ["**/node_modules/**", "eslint.config.mjs"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)) },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    files: CODE,
    rules: {
      curly: ["error", "all"],
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      "no-restricted-syntax": conventions(...TYPES_IN_TYPES_FILE, ENUMS_IN_ENUMS_FILE),
    },
  },
  {
    files: CODE.map(glob => glob.replace(/\*\.ts$/, "types.ts")),
    rules: { "no-restricted-syntax": conventions(ENUMS_IN_ENUMS_FILE) },
  },
  {
    files: CODE.map(glob => glob.replace(/\*\.ts$/, "enums.ts")),
    rules: { "no-restricted-syntax": conventions(...TYPES_IN_TYPES_FILE) },
  },
]
