import assert from 'node:assert/strict';
import { test } from 'vitest';

import { parseAmount } from '../web/scripts/utils/money.ts';

test('a typed amount is digits with one optional decimal separator', () => {
  assert.equal(parseAmount('12'), 12);
  assert.equal(parseAmount('3.50'), 3.5);
  assert.equal(parseAmount('3,50'), 3.5);
  assert.equal(parseAmount(' 7 '), 7);
  assert.equal(parseAmount(40), 40);
});

test('anything else is not an amount, instead of being read as a different number', () => {
  for (const typed of ['', 'e', '1e3', '1E3', '-5', '+5', '3.50abc', '1.2.3', '.5', 'Infinity']) {
    assert.equal(parseAmount(typed), null, typed);
  }
});
