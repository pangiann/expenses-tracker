import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

/** A stand-in WebSocket: the test opens it, answers it or keeps it silent. */
class FakeSocket extends EventTarget {
  static all = [];
  sent = [];
  isClosed = false;
  constructor(url) {
    super();
    this.url = url;
    FakeSocket.all.push(this);
  }
  send(message) {
    this.sent.push(message);
  }
  close() {
    this.isClosed = true;
  }
  open() {
    this.dispatchEvent(new Event('open'));
  }
  receive(data) {
    this.dispatchEvent(Object.assign(new Event('message'), { data }));
  }
}

const pageListeners = new Map();

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  pageListeners.clear();
  const addEventListener = (type, listener) => pageListeners.set(type, listener);
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener });
  vi.stubGlobal('window', { addEventListener });
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function startedConnection() {
  vi.resetModules();
  const { LiveUpdateConnection } = await import('../web/scripts/sync/live-update-connection.ts');
  const connection = new LiveUpdateConnection();
  const changes = [];
  let reconnects = 0;
  connection.onConnectionChange = (isConnected) => changes.push(isConnected);
  connection.onReconnect = () => reconnects++;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  connection.start();
  FakeSocket.all[0].open();
  return { connection, changes, reconnectCount: () => reconnects };
}

test('a socket that stops answering pings is replaced', async () => {
  const { connection, changes, reconnectCount } = await startedConnection();
  const first = FakeSocket.all[0];

  await vi.advanceTimersByTimeAsync(50_000); // keepalive sends a ping; no pong comes
  assert.deepEqual(first.sent, ['ping']);
  await vi.advanceTimersByTimeAsync(10_000);
  assert.equal(first.isClosed, true);
  assert.equal(connection.isConnected, false);

  await vi.advanceTimersByTimeAsync(2_000);
  assert.equal(FakeSocket.all.length, 2);
  FakeSocket.all[1].open();
  assert.deepEqual(changes, [true, false, true]);
  assert.equal(reconnectCount(), 1);
});

test('a socket that answers stays in use', async () => {
  const { connection } = await startedConnection();
  const first = FakeSocket.all[0];

  await vi.advanceTimersByTimeAsync(50_000);
  first.receive('pong');
  await vi.advanceTimersByTimeAsync(40_000); // past the pong deadline, before the next ping
  assert.equal(first.isClosed, false);
  assert.equal(connection.isConnected, true);
  assert.equal(FakeSocket.all.length, 1);
});

test('coming back to the page checks the socket at once', async () => {
  await startedConnection();
  const first = FakeSocket.all[0];

  pageListeners.get('visibilitychange')();
  assert.deepEqual(first.sent, ['ping']);
  await vi.advanceTimersByTimeAsync(10_000);
  assert.equal(first.isClosed, true);
});

test('a late close from a replaced socket does not connect twice', async () => {
  await startedConnection();
  const first = FakeSocket.all[0];

  pageListeners.get('online')();
  await vi.advanceTimersByTimeAsync(10_000);
  first.dispatchEvent(new Event('close'));
  await vi.advanceTimersByTimeAsync(30_000);
  assert.equal(FakeSocket.all.length, 2);
});
