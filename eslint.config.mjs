import { createRequire } from "node:module";
const requireFromCwd = createRequire(`${process.cwd()}/package.json`);
const js = requireFromCwd("@eslint/js");
const tsParser = requireFromCwd("@typescript-eslint/parser");
const tsPlugin = requireFromCwd("@typescript-eslint/eslint-plugin");

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules
    }
  }
];
