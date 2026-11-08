/**
 * Calling the Worker like the page does, and reading what its Durable Object stored.
 * Every test starts from an empty household (see clearHousehold).
 */
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';

import type { MonthData } from '../../shared/month/month-record.ts';
import { TEST_HOUSEHOLD } from './test-household.ts';

/** The site's address in tests: the sign-in bypass only works on localhost. */
export const SITE = 'http://localhost';

export interface Answer<Body = unknown> {
  status: number;
  body: Body;
}

/**
 * Calls an endpoint through the Worker's entry point, as the page's own fetch would: with the
 * Origin header of this site, so edits are allowed.
 */
export async function call<Body = unknown>(method: string, path: string, body?: unknown): Promise<Answer<Body>> {
  const response = await exports.default.fetch(
    new Request(`${SITE}${path}`, {
      method,
      headers: { Origin: SITE, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* plain text, for example "Forbidden" */
  }
  return { status: response.status, body: parsed as Body };
}

function householdStub() {
  return env.HOUSEHOLD_DURABLE_OBJECTS.getByName(TEST_HOUSEHOLD);
}

/** Everything the household stored, by storage key: "month:2026-11", "revision", and so on. */
export async function storedEntries(): Promise<Map<string, unknown>> {
  return runInDurableObject(householdStub(), async (_instance, state) => state.storage.list());
}

/** One stored month, exactly as saved, or undefined. */
export async function storedMonth(monthKey: string): Promise<MonthData | undefined> {
  return (await storedEntries()).get(`month:${monthKey}`) as MonthData | undefined;
}

export async function storedRevision(): Promise<number | undefined> {
  return (await storedEntries()).get('revision') as number | undefined;
}

/**
 * Empties the household's storage, so each test starts from nothing. The Durable Object is then
 * restarted, because its month repository keeps the revision and the month list in memory.
 */
export async function clearHousehold(): Promise<void> {
  await runInDurableObject(householdStub(), async (_instance, state) => {
    await state.storage.deleteAll();
  });
  await evictDurableObject(householdStub());
}
