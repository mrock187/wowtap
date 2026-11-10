import js from '@eslint/js'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist/**', 'test-results/**', 'playwright-report/**', '.local/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  { files: ['**/*.{mjs,ts}'], languageOptions: { globals: globals.node } },
  { files: ['**/*.tsx'], ...hooks.configs.flat.recommended },
]
