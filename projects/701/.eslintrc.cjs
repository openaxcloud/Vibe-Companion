/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json'],
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs'],
      },
    },
    react: {
      version: 'detect',
    },
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  plugins: [
    '@typescript-eslint',
    'import',
  ],
  rules: {
    'no-underscore-dangle': ['error', { allow: ['__typename'] }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.test.{js,jsx,ts,tsx}',
          '**/*.spec.{js,jsx,ts,tsx}',
          '**/test/**/*.{js,jsx,ts,tsx}',
          '**/tests/**/*.{js,jsx,ts,tsx}',
          '**/*.config.{js,cjs,mjs,ts}',
          '**/*.config.*.{js,cjs,mjs,ts}',
          'scripts/**/*.{js,ts}',
        ],
      },
    ],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        cjs: 'never',
        mjs: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
  },
  overrides: [
    {
      files: ['src/client/**/*.{ts,tsx,js,jsx}', 'client/**/*.{ts,tsx,js,jsx}'],
      env: {
        browser: true,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
      extends: [
        'airbnb',
        'airbnb-typescript',
        'airbnb/hooks',
      ],
      plugins: [
        'react',
        'react-hooks',
        'jsx-a11y',
      ],
      rules: {
        'react/jsx-filename-extension': [
          'error',
          { extensions: ['.tsx', '.jsx'] },
        ],
        'react/react-in-jsx-scope': 'off',
        'react/require-default-props': 'off',
        'react/jsx-props-no-spreading': 'off',
        'react/function-component-definition': [
          'error',
          {
            namedComponents: 'arrow-function',
            unnamedComponents: 'arrow-function',
          },
        ],
        'jsx-a11y/anchor-is-valid': [
          'error',
          {
            components: ['Link'],
            specialLink: ['href', 'to'],
          },
        ],
        'no-alert': 'warn',
      },
    },
    {
      files: ['src/server/**/*.{ts,js}', 'server/**/*.{ts,js}'],
      env: {
        node: true,
      },
      extends: [
        'airbnb-base',
        'airbnb-typescript/base',
      ],
      rules: {
        'no-process-exit': 'off',
        'no-console': [
          'warn',
          { allow: ['warn', 'error', 'info'] },
        ],
        'global-require': 'off',
      },
    },
    {
      files: ['**/*.config.{js,cjs,mjs,ts}', '**/*.config.*.{js,cjs,mjs,ts}'],
      env: {
        node: true,
      },
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'import/no-duplicates': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};