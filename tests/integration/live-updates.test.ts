/**
 * The live-update WebSocket: a device that watches a month gets that month after every save,
 * and a device watching another month gets nothing.
 */
import { exports } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import type { MonthResponse } from '../../shared/api/endpoints.ts';
import { SITE, call, clearHousehold } from './helpers.ts';

beforeEach(clearHousehold);

interface Device {
  socket: WebSocket;
  received: string[];
  /** Waits until the device has received this many messages, or fails after a second. */
  waitFor(count: number): Promise<void>;
}

/** Opens the page's live connection and says which month it shows. */
async function openDevice(watchedMonth: string): Promise<Device> {
  const response = await exports.default.fetch(
    new Request(`${SITE}/api/live`, { headers: { Upgrade: 'websocket', Origin: SITE } }),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const received: string[] = [];
  socket.addEventListener('message', (event) => received.push(String(event.data)));
  socket.send(JSON.stringify({ type: 'watchMonth', month: watchedMonth }));
  // Answered without waking the household: proves the watchMonth message has arrived first.
  socket.send('ping');
  const device: Device = {
    socket,
    received,
    async waitFor(count) {
      const start = Date.now();
      while (received.length < count && Date.now() - start < 1000) await new Promise((r) => setTimeout(r, 10));
      expect(received.length).toBeGreaterThanOrEqual(count);
    },
  };
  await device.waitFor(1); // the pong
  received.length = 0;
  return device;
}

test('a device watching the month gets the month after each save; another month gets nothing', async () => {
  const november = await openDevice('2026-11');
  const october = await openDevice('2026-10');

  const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
  const { body } = await call<MonthResponse>('POST', '/api/months/2026-11/expenses', coffee);

  await november.waitFor(1);
  const message = JSON.parse(november.received[0]!) as { type: string } & MonthResponse;
  expect(message.type).toBe('month');
  expect(message.month).toEqual(body.month);
  expect(message.revision).toBe(body.revision);

  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(october.received).toEqual([]);
  november.socket.close();
  october.socket.close();
});

test('a WebSocket that another website opened is refused', async () => {
  const response = await exports.default.fetch(
    new Request(`${SITE}/api/live`, { headers: { Upgrade: 'websocket', Origin: 'https://evil.example' } }),
  );
  expect(response.status).toBe(403);
});
