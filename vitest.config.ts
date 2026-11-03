import { defineConfig } from 'vitest/config';

// Unit tests run in Node.js: `npm test` once, `npm run test:watch` while you work.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,mjs}'],
  },
});
