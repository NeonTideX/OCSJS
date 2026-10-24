import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/public/**',
      '**/coverage/**',
      '**/pnpm-lock.yaml',
      '**/package-lock.json',
      '**/stats.html',
      '**/*.bak',
      '**/*.md'
    ]
  },
  {
    files: [
      'packages/**/*.{js,jsx,mjs,cjs}',
      'scripts/**/*.{js,jsx,mjs,cjs}'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        core: 'readonly',
        scripts: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: js.configs.recommended.rules
  },
  {
    // These entry files are standalone userscript bodies, not ES modules.
    files: [
      'packages/scripts/entry.common.js',
      'packages/scripts/entry.dev.js',
      'packages/scripts/entry.js'
    ],
    languageOptions: {
      sourceType: 'commonjs'
    }
  }
];

