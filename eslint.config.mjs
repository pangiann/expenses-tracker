import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import layers from './eslint/layers.mjs';

// `npm run lint`. Prettier handles layout; ESLint looks for mistakes.
export default tseslint.config(
  { ignores: ['web/dist/', 'worker/worker-configuration.d.ts', 'data/', '.wrangler/'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  // TypeScript files also get the rules that need type information, using the nearest tsconfig.json.
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React components: hooks must follow React's rules (called in the same order on every render, and so on).
  { files: ['web/scripts/**/*.tsx', 'test/**/*.tsx'], ...reactHooks.configs.flat['recommended-latest'] },

  // Which built-in globals each part of the project may use.
  { files: ['web/scripts/**', 'web/*.js'], languageOptions: { globals: globals.browser } },
  {
    files: ['worker/**'],
    languageOptions: {
      globals: { ...globals.serviceworker, WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly' },
    },
  },
  { files: ['test/**', 'scripts/**', '*.config.*'], languageOptions: { globals: globals.node } },

  // Which layer may import which: see eslint/layers.mjs and ARCHITECTURE.md.
  {
    files: ['shared/**', 'web/scripts/**', 'worker/**'],
    plugins: { layers },
    rules: { 'layers/layers': 'error' },
  },

  prettier,
);
