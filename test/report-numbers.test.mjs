import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  categoryTotals,
  daysCountedIn,
  monthDailyAverage,
  yearTotals,
} from '../web/scripts/features/reports/report-numbers.ts';

const month = (key, fields) => ({
  month: key,
  earned: 0,
  spent: 0,
  variableSpending: 0,
  recurringCostsTotal: 0,
  budgeted: 0,
  saved: 0,
  spentPerCategory: {},
  ...fields,
});

test('days counted: a past month in full, the current month so far, a future month not at all', () => {
  assert.equal(daysCountedIn('2026-10', '2026-11-08'), 31);
  assert.equal(daysCountedIn('2026-11', '2026-11-08'), 8);
  assert.equal(daysCountedIn('2026-12', '2026-11-08'), 0);
  assert.equal(daysCountedIn('2024-02', '2026-11-08'), 29);
});

test('year totals add up the months; the daily average uses the days counted', () => {
  const summary = {
    year: 2026,
    months: [
      month('2026-10', { earned: 3000, spent: 1310, variableSpending: 310 }),
      month('2026-11', { earned: 3000, spent: 1080, variableSpending: 80 }),
    ],
    categories: [],
    savedYears: [2026],
  };
  const totals = yearTotals(summary, '2026-11-08');
  assert.equal(totals.earned, 6000);
  assert.equal(totals.spent, 2390);
  assert.equal(totals.saved, 3610);
  assert.equal(totals.daysCounted, 39);
  assert.equal(totals.dailyAverage, 390 / 39);
  assert.equal(monthDailyAverage(summary.months[1], '2026-11-08'), 10);
  assert.equal(monthDailyAverage(month('2026-12', {}), '2026-11-08'), null);
});

test('category totals are summed over the year, largest first, with their share', () => {
  const summary = {
    year: 2026,
    months: [
      month('2026-10', { spentPerCategory: { lunch: 30, home: 10 } }),
      month('2026-11', { spentPerCategory: { lunch: 20, gifts: 40 } }),
    ],
    categories: [],
    savedYears: [2026],
  };
  assert.deepEqual(categoryTotals(summary), [
    { categoryId: 'lunch', spent: 50, share: 0.5 },
    { categoryId: 'gifts', spent: 40, share: 0.4 },
    { categoryId: 'home', spent: 10, share: 0.1 },
  ]);
});
