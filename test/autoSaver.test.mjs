import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AutoSaver } from '../web/scripts/services/AutoSaver.js';

/** A repository whose saves take 50 ms, recording the order they finish in. */
function slowRepository() {
  const finishedSaves = [];
  return {
    finishedSaves,
    save: (monthRecord) => new Promise((resolve) => setTimeout(() => { finishedSaves.push(monthRecord.label); resolve(); }, 50)),
  };
}

test('flush waits for a save the timer already started', async () => {
  const repository = slowRepository();
  const autoSaver = new AutoSaver(repository, { delayInMilliseconds: 10 });
  autoSaver.scheduleSave({ label: 'drag' });
  await new Promise((resolve) => setTimeout(resolve, 20)); // the timer has started the save
  await autoSaver.flush();
  assert.deepEqual(repository.finishedSaves, ['drag']);
});

test('saves are written one at a time, in order', async () => {
  const repository = slowRepository();
  const autoSaver = new AutoSaver(repository, { delayInMilliseconds: 10 });
  const firstSave = autoSaver.saveNow({ label: 'first' });
  const secondSave = autoSaver.saveNow({ label: 'second' });
  await Promise.all([firstSave, secondSave]);
  assert.deepEqual(repository.finishedSaves, ['first', 'second']);
});
