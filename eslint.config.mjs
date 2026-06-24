import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "typescript-eslint"
import prettierPluginRecommended from "eslint-plugin-prettier/recommended"
import globals from "globals"
import confusingBrowserGlobals from "confusing-browser-globals"

export default [
  js.configs.recommended,
  prettierPluginRecommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      typescript: tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/client/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        VENUS_INFLUX_LOADER_ADMIN_API_PORT: true,
        VENUS_INFLUX_LOADER_BUILD_VERSION: true,
      },
    },
    rules: {
      "no-restricted-globals": ["error"].concat(confusingBrowserGlobals),
    },
  },
  {
    files: ["src/server/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]
