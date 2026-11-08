import { defineConfig, devices } from '@playwright/test';

import { SITE, TEST_EMAIL, TEST_HOUSEHOLD, UI_TEST_PORT } from './test-site.ts';

/**
 * Playwright starts its own `wrangler dev` on port 8788, never your `npm run dev` on 8787, with
 * its own storage in tests/ui/.state (emptied at every start) and a test login for localhost.
 * Each test then sets up the months it needs through the app's own import endpoint.
 *
 * The tests share one household, so they run one at a time.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: SITE,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@phone/ },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, grep: /@phone/ },
  ],
  webServer: {
    // From the repo root, so wrangler finds wrangler.jsonc. The --var values replace whatever your
    // own .dev.vars sets, so the tests always sign in the same way.
    cwd: '../..',
    command: [
      'rm -rf tests/ui/.state &&',
      `npx wrangler dev --port ${UI_TEST_PORT} --persist-to tests/ui/.state`,
      `--var ACCESS_TEST_BYPASS_EMAIL:${TEST_EMAIL}`,
      `--var 'HOUSEHOLD_MEMBERS:{"${TEST_EMAIL}":"${TEST_HOUSEHOLD}"}'`,
      '--var ACCESS_TEAM_DOMAIN: --var ACCESS_AUD:',
    ].join(' '),
    url: SITE,
    env: { CI: 'true' },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
