/** Where the UI tests' own `wrangler dev` runs, and who they sign in as there. */
export const UI_TEST_PORT = 8788;
/** localhost, not 127.0.0.1 or an IP: the sign-in bypass only works on localhost. */
export const SITE = `http://localhost:${UI_TEST_PORT}`;
export const TEST_EMAIL = 'tester@example.com';
export const TEST_HOUSEHOLD = 'ui-test-household';
