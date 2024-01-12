const restrictedGlobals = require('confusing-browser-globals');

module.exports = {
  env: {
    es6: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  plugins: ["node"],
  rules: {
    "no-console": "off",
    "no-undef": "off",
    "no-useless-escape": "off",
    "no-inner-declarations": "off",
    "no-redeclare": "off",
    "space-before-function-paren": ["error", "always"],
    "no-unused-vars": ["off", { argsIgnorePattern: "^_" }],
    quotes: ["error", "single", { avoidEscape: true }],
    semi: [2, "never"],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "array-callback-return": "error",
    "for-direction": "error",
    "no-extra-bind": "error",
    "no-duplicate-imports": "error",
    "no-eval": "error",
    "no-extend-native": "error",
    "no-implied-eval": "error",
    "no-labels": "error",
    "no-restricted-globals": ["error"].concat(restrictedGlobals),
    "no-useless-computed-key": "error",
    "unicode-bom": "error",
    curly: "error",
    eqeqeq: [
      "error",
      "always",
      {
        null: "ignore",
      },
    ],
    // "object-curly-spacing": ["error", "never"],
    "prefer-const": "error",
    "no-var": "error",
    "no-invalid-this": "error",
    "no-path-concat": "error",
  },
  settings: {
    react: {
      version: "detect",
    }
  }
}
