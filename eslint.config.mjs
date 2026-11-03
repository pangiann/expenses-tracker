import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// `npm run lint`. Prettier handles layout; ESLint looks for mistakes.
export default tseslint.config(
  { ignores: ['web/dist/', 'worker/worker-configuration.d.ts', 'data/', '.wrangler/'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  // TypeScript files also get the rules that need type information, using the nearest tsconfig.json.
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Which built-in globals each part of the project may use.
  { files: ['web/scripts/**'], languageOptions: { globals: globals.browser } },
  {
    files: ['worker/**'],
    languageOptions: {
      globals: { ...globals.serviceworker, WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly' },
    },
  },
  { files: ['test/**', 'scripts/**', '*.config.*'], languageOptions: { globals: globals.node } },

  prettier,
);
