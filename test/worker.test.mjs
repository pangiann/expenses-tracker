import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AccessDeniedError, resolveSignedInUserEmail } from '../worker/sign-in/signed-in-user-resolver.ts';
import {
  UnknownMemberError,
  findHouseholdNameForEmail,
  parseHouseholdMembers,
} from '../worker/sign-in/household-membership-lookup.ts';
import { isRequestFromOwnPage } from '../worker/sign-in/same-origin-request-check.ts';

const MEMBERS = JSON.stringify({ 'Me@Example.com': 'home', 'sister@example.com': 'sister', 'bad@example.com': '../x' });

test('emails map to households, case-insensitively', () => {
  assert.equal(findHouseholdNameForEmail('me@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), 'home');
  assert.equal(findHouseholdNameForEmail('sister@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), 'sister');
});

test('unknown emails, invalid household names and a missing setting are refused', () => {
  assert.throws(
    () => findHouseholdNameForEmail('stranger@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }),
    UnknownMemberError,
  );
  assert.throws(() => findHouseholdNameForEmail('bad@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), UnknownMemberError);
  assert.throws(() => findHouseholdNameForEmail('me@example.com', {}), UnknownMemberError);
  assert.equal(parseHouseholdMembers('not json').size, 0);
});

test('the email comes from Cloudflare Access (ctx.access)', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const context = { access: { getIdentity: async () => ({ email: 'Me@Example.com' }) } };
  assert.equal(await resolveSignedInUserEmail(request, {}, context), 'me@example.com');
});

test('a request Access did not authenticate is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  await assert.rejects(resolveSignedInUserEmail(request, {}, {}), AccessDeniedError);
  await assert.rejects(resolveSignedInUserEmail(request, {}, undefined), AccessDeniedError);
});

test('the team domain is accepted with or without https:// and a trailing slash', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': 'not.a.token' },
  });
  for (const teamDomain of ['team.cloudflareaccess.com/', ' https://team.cloudflareaccess.com ']) {
    await assert.rejects(
      resolveSignedInUserEmail(request, { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: 'aud' }, {}),
      (error) => error.problem === 'invalid-sign-in',
    );
  }
});

test('a signed-in request without token settings asks for them', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': 'some.signed.token' },
  });
  await assert.rejects(
    resolveSignedInUserEmail(request, {}, {}),
    (error) => error.problem === 'access-needs-token-settings',
  );
});

test('a sign-in without an email is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const context = { access: { getIdentity: async () => ({}) } };
  await assert.rejects(resolveSignedInUserEmail(request, {}, context), AccessDeniedError);
});

test('with the optional token secrets, a request without a token is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const env = { ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'aud' };
  await assert.rejects(resolveSignedInUserEmail(request, env, {}), AccessDeniedError);
});

test('a forged token is refused', async () => {
  const forgedPayload = Buffer.from(JSON.stringify({ email: 'me@example.com' })).toString('base64url');
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': `eyJhbGciOiJub25lIn0.${forgedPayload}.` },
  });
  const env = { ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'aud' };
  await assert.rejects(resolveSignedInUserEmail(request, env, {}), AccessDeniedError);
});

test('the local test bypass works on localhost only', async () => {
  const env = { ACCESS_TEST_BYPASS_EMAIL: 'Me@Example.com' };
  assert.equal(
    await resolveSignedInUserEmail(new Request('http://localhost:8787/api/live'), env, {}),
    'me@example.com',
  );
  await assert.rejects(
    resolveSignedInUserEmail(new Request('https://expenses.example.workers.dev/api/live'), env, {}),
    AccessDeniedError,
  );
});

test('WebSockets opened by other websites are refused', () => {
  const fromOwnPage = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { Origin: 'https://expenses.example.workers.dev' },
  });
  const fromOtherSite = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { Origin: 'https://evil.example.com' },
  });
  assert.equal(isRequestFromOwnPage(fromOwnPage), true);
  assert.equal(isRequestFromOwnPage(fromOtherSite), false);
  assert.equal(isRequestFromOwnPage(new Request('https://expenses.example.workers.dev/api/live')), false);
});

test('endpoint calls from another website are refused before they reach the household', async () => {
  const { default: worker } = await import('../worker/worker-entry-point.ts');
  const forwarded = [];
  const env = {
    ACCESS_TEST_BYPASS_EMAIL: 'me@example.com',
    HOUSEHOLD_MEMBERS: JSON.stringify({ 'me@example.com': 'home' }),
    HOUSEHOLD_DURABLE_OBJECTS: {
      getByName: (name) => ({
        fetch: async (request) => (forwarded.push(`${name} ${request.method}`), new Response('ok')),
      }),
    },
  };
  const call = (method, headers) =>
    worker.fetch(new Request('http://localhost:8787/api/months/2026-11/expenses', { method, headers }), env, {});

  assert.equal((await call('POST', { Origin: 'http://localhost:8787', 'Sec-Fetch-Site': 'same-origin' })).status, 200);
  assert.equal((await call('POST', { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await call('POST', {})).status, 403, 'an edit needs an Origin');
  assert.equal((await call('GET', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await call('GET', {})).status, 200, 'a read from curl works');
  assert.deepEqual(forwarded, ['home POST', 'home GET']);
});
