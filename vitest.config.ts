import { defineConfig } from 'vitest/config';

// Unit tests run in Node.js: `npm test` once, `npm run test:watch` while you work.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx,mjs}'],
  },
  resolve: {
    // Cloudflare's runtime module doesn't exist in Node.js; tests get a stand-in.
    alias: { 'cloudflare:workers': new URL('test/stubs/cloudflare-workers.mjs', import.meta.url).pathname },
  },
});
