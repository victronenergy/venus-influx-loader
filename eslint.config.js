import { configs as jsConfigs } from "@eslint/js"
import babelParser from "@babel/eslint-parser"
import reactPlugin, { configs as reactConfigs } from "eslint-plugin-react"
import prettierPluginRecommended from "eslint-plugin-prettier/recommended"
import { node, browser } from "globals"
import confusingBrowserGlobals from "confusing-browser-globals"

export default [
  jsConfigs.recommended,
  prettierPluginRecommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      react: reactPlugin,
    },
    rules: {
      ...reactConfigs.recommended.rules,
      ...reactConfigs["jsx-runtime"].rules,
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...node,
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
        ...browser,
        ...reactConfigs.settings.react.globals,
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
        ...node,
      },
    },
  },
]
