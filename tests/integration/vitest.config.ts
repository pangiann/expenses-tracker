import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

import { TEST_EMAIL, TEST_HOUSEHOLD } from './test-household.ts';

/**
 * The tests run inside workerd, Cloudflare's runtime, with the app's own wrangler.jsonc: the
 * same Worker, the same Durable Object class, real Durable Object storage. Only the secrets are
 * set here, so requests to localhost sign in as TEST_EMAIL without Cloudflare Access.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: '../../wrangler.jsonc' },
      miniflare: {
        // These replace whatever your own .dev.vars sets, so the tests always sign in the same way.
        bindings: {
          ACCESS_TEAM_DOMAIN: '',
          ACCESS_AUD: '',
          ACCESS_TEST_BYPASS_EMAIL: TEST_EMAIL,
          HOUSEHOLD_MEMBERS: JSON.stringify({ [TEST_EMAIL]: TEST_HOUSEHOLD }),
        },
      },
    }),
  ],
  test: {
    include: ['**/*.test.ts'],
  },
});
