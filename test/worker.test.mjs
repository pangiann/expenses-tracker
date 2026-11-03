import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AccessDeniedError, verifiedUserEmail } from '../worker/accessAuth.js';
import { UnknownMemberError, householdForEmail, parseHouseholdMembers } from '../worker/households.js';
import { isSameOriginRequest } from '../worker/index.js';

const MEMBERS = JSON.stringify({ 'Me@Example.com': 'home', 'sister@example.com': 'sister', 'bad@example.com': '../x' });

test('emails map to households, case-insensitively', () => {
  assert.equal(householdForEmail('me@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), 'home');
  assert.equal(householdForEmail('sister@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), 'sister');
});

test('unknown emails, invalid household names and a missing setting are refused', () => {
  assert.throws(() => householdForEmail('stranger@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), UnknownMemberError);
  assert.throws(() => householdForEmail('bad@example.com', { HOUSEHOLD_MEMBERS: MEMBERS }), UnknownMemberError);
  assert.throws(() => householdForEmail('me@example.com', {}), UnknownMemberError);
  assert.equal(parseHouseholdMembers('not json').size, 0);
});

test('the email comes from Cloudflare Access (ctx.access)', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const context = { access: { getIdentity: async () => ({ email: 'Me@Example.com' }) } };
  assert.equal(await verifiedUserEmail(request, {}, context), 'me@example.com');
});

test('a request Access did not authenticate is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  await assert.rejects(verifiedUserEmail(request, {}, {}), AccessDeniedError);
  await assert.rejects(verifiedUserEmail(request, {}, undefined), AccessDeniedError);
});

test('the team domain is accepted with or without https:// and a trailing slash', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': 'not.a.token' },
  });
  for (const teamDomain of ['team.cloudflareaccess.com/', ' https://team.cloudflareaccess.com ']) {
    await assert.rejects(
      verifiedUserEmail(request, { ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: 'aud' }, {}),
      (error) => error.problem === 'invalid-sign-in',
    );
  }
});

test('a signed-in request without token settings asks for them', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': 'some.signed.token' },
  });
  await assert.rejects(verifiedUserEmail(request, {}, {}), (error) => error.problem === 'access-needs-token-settings');
});

test('a sign-in without an email is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const context = { access: { getIdentity: async () => ({}) } };
  await assert.rejects(verifiedUserEmail(request, {}, context), AccessDeniedError);
});

test('with the optional token secrets, a request without a token is refused', async () => {
  const request = new Request('https://expenses.example.workers.dev/api/live');
  const env = { ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'aud' };
  await assert.rejects(verifiedUserEmail(request, env, {}), AccessDeniedError);
});

test('a forged token is refused', async () => {
  const forgedPayload = Buffer.from(JSON.stringify({ email: 'me@example.com' })).toString('base64url');
  const request = new Request('https://expenses.example.workers.dev/api/live', {
    headers: { 'Cf-Access-Jwt-Assertion': `eyJhbGciOiJub25lIn0.${forgedPayload}.` },
  });
  const env = { ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com', ACCESS_AUD: 'aud' };
  await assert.rejects(verifiedUserEmail(request, env, {}), AccessDeniedError);
});

test('the local test bypass works on localhost only', async () => {
  const env = { ACCESS_TEST_BYPASS_EMAIL: 'Me@Example.com' };
  assert.equal(await verifiedUserEmail(new Request('http://localhost:8787/api/live'), env, {}), 'me@example.com');
  await assert.rejects(
    verifiedUserEmail(new Request('https://expenses.example.workers.dev/api/live'), env, {}),
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
  assert.equal(isSameOriginRequest(fromOwnPage), true);
  assert.equal(isSameOriginRequest(fromOtherSite), false);
  assert.equal(isSameOriginRequest(new Request('https://expenses.example.workers.dev/api/live')), false);
});
