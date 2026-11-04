import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';

import { DEFAULT_CATEGORIES } from '../shared/month/categories.ts';

const WEB_DIR = new URL('../web/', import.meta.url).pathname;
const readTranslations = (language) => JSON.parse(readFileSync(join(WEB_DIR, 'i18n', `${language}.json`), 'utf8'));
const english = readTranslations('en');
const greek = readTranslations('el');

/** The page's source files: .ts and .tsx. */
function sourceFilesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

/** Every string id the code uses: t('…'), data-i18n…="…", and the ids built from categories and months. */
function usedStringIds() {
  const ids = new Set();
  for (const file of sourceFilesUnder(join(WEB_DIR, 'scripts'))) {
    for (const [, id] of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([\w.]+)'/g)) ids.add(id);
    for (const [, id] of readFileSync(file, 'utf8').matchAll(/(?:stringId|untitledStringId)\s*[:=]\s*'([\w.]+)'/g))
      ids.add(id);
    for (const [, id] of readFileSync(file, 'utf8').matchAll(/'(error\.\w+)'/g)) ids.add(id);
  }
  for (const [, id] of readFileSync(join(WEB_DIR, 'index.html'), 'utf8').matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g))
    ids.add(id);
  for (const category of DEFAULT_CATEGORIES) ids.add(category.nameId);
  for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) ids.add(`month.${monthNumber}`);
  return ids;
}

test('English and Greek have exactly the same string ids', () => {
  const englishIds = Object.keys(english).sort();
  const greekIds = Object.keys(greek).sort();
  assert.deepEqual(
    greekIds.filter((id) => !(id in english)),
    [],
    'ids only in el.json',
  );
  assert.deepEqual(
    englishIds.filter((id) => !(id in greek)),
    [],
    'ids missing from el.json',
  );
});

test('every string id used by the page exists in the translations', () => {
  const missing = [...usedStringIds()].filter((id) => !(id in english));
  assert.deepEqual(missing, []);
});

test('placeholders match between languages', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const id of Object.keys(english)) {
    assert.deepEqual(placeholders(greek[id]), placeholders(english[id]), id);
  }
});

test('no translation is left empty', () => {
  for (const [language, strings] of [
    ['en', english],
    ['el', greek],
  ]) {
    for (const [id, text] of Object.entries(strings)) assert.notEqual(text.trim(), '', `${language}: ${id}`);
  }
});
