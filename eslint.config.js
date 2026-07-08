// Flat ESLint config for the Code Change Understanding Agent.
//
// Pragmatic setup: TypeScript-ESLint's (non-type-checked) recommended rules to
// catch real problems fast, with a few high-signal rules kept as errors and the
// noisier stylistic ones relaxed to warnings so `npm run lint` stays a useful
// signal rather than a wall of pre-existing failures.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.d.ts'],
  },
  {
    // Pre-existing `eslint-disable no-console` directives are intentional entry-
    // point logging; don't fail on them (the rule itself is not enabled here).
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts', 'scripts/**/*.ts', 'examples/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
