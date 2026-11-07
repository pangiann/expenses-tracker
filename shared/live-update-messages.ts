/**
 * The messages on the live WebSocket (/api/live) between the page and its household.
 * The WebSocket only brings updates: edits are HTTP requests (shared/api/endpoints.ts).
 *
 *   page -> household:  watchMonth  "send me updates of this month"
 *   household -> page:  month       the month after someone saved an edit to it
 *
 * Both sides parse what they receive with these schemas. The keepalive "ping" and "pong"
 * are plain text, not JSON; Cloudflare answers them without waking the Durable Object.
 */
// zod/mini has the same checks as zod in a form bundlers can trim (see api/fields.ts).
import * as z from 'zod/mini';

import type { MonthResponse } from './api/endpoints.ts';
import { MonthKeyField } from './api/fields.ts';
import type { MonthData } from './month/month-record.ts';
import { isMonthData } from './month/month-validation.ts';

/** A whole month. Only its basic shape is checked; MonthRecord reads the rest. */
const Month = z.custom<MonthData>(isMonthData, 'Not a month');

export const ClientMessageSchema = z.discriminatedUnion('type', [
  /** This device shows this month now. Its current version comes from GET /api/months/:month. */
  z.object({ type: z.literal('watchMonth'), month: MonthKeyField }),
]);

export type ClientMessage = z.output<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  /** The same as the answer to an edit: see MonthResponse. */
  z.object({ type: z.literal('month'), month: Month, monthKeys: z.array(MonthKeyField), revision: z.number() }),
]);

export type ServerMessage = { type: 'month' } & MonthResponse;

export class InvalidMessageError extends Error {}

/** Parses a message from the page. @throws {InvalidMessageError} */
export function parseClientMessage(text: string): ClientMessage {
  return parse(ClientMessageSchema, text);
}

/** Parses a message from the server. @throws {InvalidMessageError} */
export function parseServerMessage(text: string): ServerMessage {
  return parse(ServerMessageSchema, text);
}

export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

function parse<Schema extends z.ZodMiniType>(schema: Schema, text: string): z.output<Schema> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new InvalidMessageError('Message is not JSON');
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new InvalidMessageError(`Invalid message: ${z.prettifyError(result.error)}`);
  return result.data;
}
