import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { chooseTheme, currentThemeChoice } from '../web/scripts/utils/theme-choice.ts';

let storedItems;
let eventsFired;

beforeEach(() => {
  storedItems = new Map();
  eventsFired = [];
  vi.stubGlobal('localStorage', {
    getItem: (key) => storedItems.get(key) ?? null,
    setItem: (key, value) => storedItems.set(key, value),
    removeItem: (key) => storedItems.delete(key),
  });
  vi.stubGlobal('dispatchEvent', (event) => eventsFired.push(event.type));
});

afterEach(() => vi.unstubAllGlobals());

test('the theme is auto until someone chooses, and a choice is saved and announced', () => {
  assert.equal(currentThemeChoice(), 'auto');
  chooseTheme('dark');
  assert.equal(currentThemeChoice(), 'dark');
  assert.equal(storedItems.get('expenses.theme'), 'dark'); // the key web/theme-before-paint.js reads
  chooseTheme('auto');
  assert.equal(currentThemeChoice(), 'auto');
  assert.equal(storedItems.has('expenses.theme'), false);
  assert.deepEqual(eventsFired, ['expenses:theme-chosen', 'expenses:theme-chosen']);
});

test('a saved value that is not a choice counts as auto', () => {
  storedItems.set('expenses.theme', 'purple');
  assert.equal(currentThemeChoice(), 'auto');
});
