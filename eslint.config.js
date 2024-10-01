const eslint = require('@eslint/js');
const babelParser = require('@babel/eslint-parser');
const reactPlugin = require('eslint-plugin-react');
const prettierPluginRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');
const confusingBrowserGlobals = require('confusing-browser-globals');

module.exports = [
  eslint.configs.recommended,
  prettierPluginRecommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: reactPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'no-unused-vars': ['error', { 'varsIgnorePattern': '^_', 'argsIgnorePattern': '^_' }]
    },
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }, {
    files: ['src/client/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        'VENUS_INFLUX_LOADER_ADMIN_API_PORT': true,
      }
    },
    rules: {
      'no-restricted-globals': ['error'].concat(confusingBrowserGlobals),
    },
  }, {
    files: ['src/server/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  }
  // parserOptions: {
  //   "ecmaVersion": 2020,
  //   "sourceType": "module",
  //   "ecmaFeatures": {
  //     "jsx": true
  //   }
  // },
  // plugins: ["node"],
  // rules: {
  //   "no-console": "off",
  //   "no-undef": "off",
  //   "no-useless-escape": "off",
  //   "no-inner-declarations": "off",
  //   "no-redeclare": "off",
  //   "space-before-function-paren": ["error", "always"],
  //   "no-unused-vars": ["off", { argsIgnorePattern: "^_" }],
  //   quotes: ["error", "single", { avoidEscape: true }],
  //   semi: [2, "never"],
  //   "linebreak-style": [
  //     "error",
  //     "unix"
  //   ],
  //   "array-callback-return": "error",
  //   "for-direction": "error",
  //   "no-extra-bind": "error",
  //   "no-duplicate-imports": "error",
  //   "no-eval": "error",
  //   "no-extend-native": "error",
  //   "no-implied-eval": "error",
  //   "no-labels": "error",
  //   "no-restricted-globals": ["error"].concat(restrictedGlobals),
  //   "no-useless-computed-key": "error",
  //   "unicode-bom": "error",
  //   curly: "error",
  //   eqeqeq: [
  //     "error",
  //     "always",
  //     {
  //       null: "ignore",
  //     },
  //   ],
  //   // "object-curly-spacing": ["error", "never"],
  //   "prefer-const": "error",
  //   "no-var": "error",
  //   "no-invalid-this": "error",
  //   "no-path-concat": "error",
  // },
]
