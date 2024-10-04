const eslint = require("@eslint/js")
const babelParser = require("@babel/eslint-parser")
const reactPlugin = require("eslint-plugin-react")
const prettierPluginRecommended = require("eslint-plugin-prettier/recommended")
const globals = require("globals")
const confusingBrowserGlobals = require("confusing-browser-globals")

module.exports = [
  eslint.configs.recommended,
  prettierPluginRecommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      react: reactPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
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
        VENUS_INFLUX_LOADER_ADMIN_API_PORT: true,
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
