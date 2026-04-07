/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.d.ts'],
      },
      typescript: {
        alwaysTryTypes: true,
        project: ['./tsconfig.json', './frontend/tsconfig.json', './backend/tsconfig.json'],
      },
    },
  },
  plugins: ['@typescript-eslint', 'import', 'unused-imports', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  rules: {
    // General JS/TS rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-unused-vars': 'off',

    // TypeScript
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
      },
    ],

    // Imports
    'import/order': [
      'warn',
      {
        'newlines-between': 'always',
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
          'object',
          'type',
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/newline-after-import': 'warn',
    'import/no-unresolved': 'error',
    'import/no-named-as-default': 'off',
    'import/no-default-export': 'off',

    // Unused imports
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // React / JSX
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'warn',
  },
  overrides: [
    // Backend (Node) configuration
    {
      files: ['backend/**/*.{js,cjs,mjs,ts}'],
      env: {
        node: true,
        browser: false,
      },
      parserOptions: {
        project: ['./backend/tsconfig.json'],
      },
      rules: {
        'no-console': 'off',
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        'react/jsx-uses-vars': 'off',
      },
    },

    // Frontend (React/Browser) configuration
    {
      files: ['frontend/**/*.{js,cjs,mjs,jsx,ts,tsx}'],
      env: {
        browser: true,
        node: false,
      },
      parserOptions: {
        project: ['./frontend/tsconfig.json'],
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: {
        'no-alert': 'warn',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },

    // Config and tooling files
    {
      files: ['*.config.{js,cjs,mjs,ts}', 'scripts/**/*.{js,cjs,mjs,ts}'],
      env: {
        node: true,
      },
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    'out/',
    '*.d.ts',
  ],
};