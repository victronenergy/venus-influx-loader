import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "typescript-eslint"
import reactPlugin from "eslint-plugin-react"
import prettierPluginRecommended from "eslint-plugin-prettier/recommended"
import globals from "globals"
import confusingBrowserGlobals from "confusing-browser-globals"

export default [
  js.configs.recommended,
  prettierPluginRecommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      typescript: tsPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...tsPlugin.configs.recommended.rules,
      "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["src/client/**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...reactPlugin.configs.recommended.globals,
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
