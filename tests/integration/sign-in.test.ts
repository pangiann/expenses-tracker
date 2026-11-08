/**
 * Who may call the Worker: requests started by another website, edits without this site's
 * Origin, and people outside every household are refused, and nothing is stored.
 */
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import worker from '../../worker/worker-entry-point.ts';
import { SITE, call, clearHousehold, storedEntries } from './helpers.ts';
import { TEST_EMAIL, TEST_HOUSEHOLD } from './test-household.ts';

const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

beforeEach(clearHousehold);

/** Sends a request straight to the Worker's fetch, with these secrets replacing the test ones. */
async function fetchWith(request: Request, secrets: Partial<Env>): Promise<Response> {
  const context = createExecutionContext();
  // A test-made Request lacks the cf properties Cloudflare adds to real ones; the Worker doesn't read them.
  const incoming = request as Request<unknown, IncomingRequestCfProperties>;
  const response = await worker.fetch(incoming, { ...env, ...secrets }, context);
  await waitOnExecutionContext(context);
  return response;
}

const addCoffee = (headers: Record<string, string>) =>
  new Request(`${SITE}/api/months/2026-11/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(coffee),
  });

test('an edit without this site’s Origin is refused', async () => {
  const response = await fetchWith(addCoffee({}), {});
  expect(response.status).toBe(403);
  const fromElsewhere = await fetchWith(addCoffee({ Origin: 'https://evil.example' }), {});
  expect(fromElsewhere.status).toBe(403);
  expect([...(await storedEntries()).keys()]).toEqual([]);
});

test('a request another website started is refused, even a read', async () => {
  const read = new Request(`${SITE}/api/months/2026-11`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  expect((await fetchWith(read, {})).status).toBe(403);
  expect([...(await storedEntries()).keys()]).toEqual([]);
});

test('someone who is not in a household is refused, and /api/status says why', async () => {
  const stranger = { ACCESS_TEST_BYPASS_EMAIL: 'stranger@example.com' };
  const response = await fetchWith(addCoffee({ Origin: SITE }), stranger);
  expect(response.status).toBe(403);
  expect([...(await storedEntries()).keys()]).toEqual([]);

  const status = await fetchWith(new Request(`${SITE}/api/status`), stranger);
  expect(status.status).toBe(403);
  expect(await status.json()).toMatchObject({ problem: 'not-a-member', email: 'stranger@example.com' });
});

test('without any sign-in, the Worker refuses and explains that Access is not switched on', async () => {
  const response = await fetchWith(new Request(`${SITE}/api/status`), { ACCESS_TEST_BYPASS_EMAIL: '' });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ problem: 'access-not-enabled' });
});

test('the sign-in bypass only works on localhost', async () => {
  const onTheRealSite = new Request('https://expenses.example.com/api/status');
  const response = await fetchWith(onTheRealSite, {});
  expect(response.status).toBe(403);
});

test('a member of the household is let in', async () => {
  const response = await call('GET', '/api/status');
  expect(response.status).toBe(200);
  expect(TEST_EMAIL).toContain('@');
  expect(TEST_HOUSEHOLD).toBeTruthy();
});
