import defineConfig from '@antfu/eslint-config'

export default defineConfig(
  {
    react: true,
    typescript: true,
    rules: {
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,ts,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'style/arrow-parens': 'off',
    },
  },
  {
    files: ['jest.setup.ts'],
    rules: {
      'ts/no-require-imports': 'off',
    },
  },
  {
    rules: {
      'style/operator-linebreak': 'off',
      'style/arrow-parens': 'off',
      'style/brace-style': 'off',
      'style/multiline-ternary': 'off',
      'style/jsx-curly-newline': 'off',
      'style/jsx-one-expression-per-line': 'off',
    },
  },
  {
    ignores: [
      '.expo/**',
      'assets/**',
      'coverage/**',
      'dist/**',
      'docs/**',
      'node_modules/**',
      'pnpm-lock.yaml',
    ],
  },
)
