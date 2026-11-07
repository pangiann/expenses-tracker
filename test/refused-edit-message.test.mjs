import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

import { ApiError } from '../web/scripts/api/endpoint-http-client.ts';
import { refusedEditMessage } from '../web/scripts/sync/refused-edit-message.ts';

// Without loaded translations, t() returns the string id, so the tests see which message was picked.
const MONTH_RULES = [
  ...readFileSync(new URL('../shared/month/month-record.ts', import.meta.url), 'utf8')
    .match(/export type MonthRule =([^;]+);/)[1]
    .matchAll(/'([\w-]+)'/g),
].map((match) => match[1]);

test('each month rule has its own message', () => {
  const stringIds = MONTH_RULES.map((rule) => refusedEditMessage(new ApiError(409, 'Month rule broken', rule)));
  assert.equal(MONTH_RULES.length, 8);
  assert.equal(new Set(stringIds).size, MONTH_RULES.length);
  assert.ok(stringIds.every((id) => id.startsWith('error.editRefused') && id !== 'error.editRefused'));
  assert.equal(
    refusedEditMessage(new ApiError(409, 'Month rule broken', 'category-has-expenses')),
    'error.editRefusedCategoryHasExpenses',
  );
});

test('a refusal without a rule gets the general message', () => {
  assert.equal(refusedEditMessage(new ApiError(400, 'Bad request')), 'error.editRefused');
});
