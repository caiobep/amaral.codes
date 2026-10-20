import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import astro from 'eslint-plugin-astro'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sourceLimits = {
  complexity: ['error', 6],
  'max-depth': ['error', 3],
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': [
    'error',
    { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  'max-nested-callbacks': ['error', 3],
  'max-params': ['error', 4],
  'max-statements': ['error', 30],
}

const sharedRules = {
  'comma-dangle': 'off',
  'space-before-function-paren': 'off',
}

export default defineConfig(
  {
    ignores: [
      '**/.astro/**',
      '**/.next/**',
      '**/.local/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
    ],
  },
  {
    files: ['experiments/sveltia/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: sharedRules,
  },
  {
    files: ['experiments/sveltia/editor/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.browser },
    rules: sharedRules,
  },
  {
    files: ['packages/**/*.{js,mjs,ts,tsx}', 'scripts/**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: sharedRules,
  },
  {
    files: ['packages/{content-contract,content-sync}/**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...sourceLimits,
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/prefer-readonly': 'error',
      'preserve-caught-error': 'off',
    },
  },
  {
    files: ['packages/website/**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/prefer-readonly': 'error',
    },
  },
  ...astro.configs.recommended,
  {
    files: ['packages/website/src/**/*.{astro,js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: sourceLimits,
  },
  {
    files: [
      'packages/website/scripts/**/*.{js,mjs,ts}',
      'packages/website/vitest.config.ts',
    ],
    rules: sourceLimits,
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
)
