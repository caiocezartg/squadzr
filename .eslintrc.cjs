const MOTION_MESSAGE =
  'Use the lightweight m components from "motion/react-m" instead of the full motion components: they throw under LazyMotion strict mode and pull every animation feature into the initial JavaScript.'

// Entries whose exports are all full components, plus the `motion` export of the entries that also
// export LazyMotion and the feature bundles. ESLint also reports a namespace import of these entries
// (`import * as motion`), since its members would be the full components.
const MOTION_FULL_IMPORTS = [
  { name: 'motion/react-client', message: MOTION_MESSAGE },
  { name: 'framer-motion/client', message: MOTION_MESSAGE },
  { name: 'motion', importNames: ['motion'], message: MOTION_MESSAGE },
  { name: 'motion/react', importNames: ['motion'], message: MOTION_MESSAGE },
  { name: 'framer-motion', importNames: ['motion'], message: MOTION_MESSAGE },
]

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.gen.ts',
    '**/*.gen.tsx',
    '**/drizzle/meta/**',
    'coverage',
    '.eslintrc.cjs',
    '*.js',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // General rules
    'no-console': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      // React rules belong to the client workspace only.
      files: ['client/**/*.{ts,tsx}'],
      env: {
        browser: true,
      },
      plugins: ['react', 'react-hooks'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
      ],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/prop-types': 'off',
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'no-restricted-imports': ['error', { paths: MOTION_FULL_IMPORTS }],
      },
    },
    {
      // Test-specific TypeScript relaxations apply to both workspace runners.
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
    {
      // The client test script uses Vitest; keep its globals out of server lint.
      files: [
        'client/**/*.test.ts',
        'client/**/*.test.tsx',
        'client/**/*.spec.ts',
        'client/**/*.spec.tsx',
      ],
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        test: 'readonly',
        vi: 'readonly',
      },
    },
    {
      // The server suite also runs under Vitest; globals mirror the client
      // block because tests import the runner API explicitly.
      files: [
        'server/**/*.test.ts',
        'server/**/*.test.tsx',
        'server/**/*.spec.ts',
        'server/**/*.spec.tsx',
      ],
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        test: 'readonly',
        vi: 'readonly',
      },
    },
  ],
}
