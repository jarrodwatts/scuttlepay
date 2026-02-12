import tseslint from "typescript-eslint";

/** @type {import("typescript-eslint").ConfigArray} */
export default [
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**"] },
  ...tseslint.configs.recommended,
];
