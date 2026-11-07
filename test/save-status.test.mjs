import assert from 'node:assert/strict';
import { test } from 'vitest';

import { ApiError } from '../web/scripts/api/endpoint-http-client.ts';
import { saveStatusFor } from '../web/scripts/sync/save-status.ts';

const refused = { kind: 'refused', error: new ApiError(409, 'Month rule broken', 'last-category') };

test('connected: the outbox decides', () => {
  assert.equal(saveStatusFor(true, { kind: 'idle' }), 'saved');
  assert.equal(saveStatusFor(true, { kind: 'sending', waiting: 2 }), 'saving');
  assert.equal(saveStatusFor(true, { kind: 'offline', waiting: 2 }), 'offline');
  assert.equal(saveStatusFor(true, refused), 'failed');
});

test('not connected: offline, whatever the outbox says', () => {
  for (const state of [{ kind: 'idle' }, { kind: 'sending', waiting: 1 }, refused]) {
    assert.equal(saveStatusFor(false, state), 'offline');
  }
});
