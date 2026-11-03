/**
 * Every message between the page and the household's Durable Object, in both directions.
 * They travel as JSON over one WebSocket (/api/live). Both sides parse what they receive
 * with these schemas, so a message that doesn't match is refused in one place instead of
 * being checked field by field in each handler.
 *
 * The keepalive "ping" and "pong" are plain text, not JSON; Cloudflare answers them
 * without waking the Durable Object.
 */
// zod/mini has the same checks as zod in a form bundlers can trim (see month/month-changes.ts).
import * as z from 'zod/mini';

import type { MonthData, StoredMonthData } from './month/month-record.ts';
import { MONTH_KEY_PATTERN, isMonthData } from './month/month-validation.ts';

const MonthKey = z.string().check(z.regex(MONTH_KEY_PATTERN));
const ChangeId = z.string().check(z.minLength(1), z.maxLength(64));

/** A whole month. Only its basic shape is checked; MonthRecord reads older formats too. */
const Month = z.custom<StoredMonthData>(isMonthData, 'Not a month');

// ----- Page -> Durable Object -----

export const ClientMessageSchema = z.discriminatedUnion('type', [
  /** Show this month, creating it if missing; the reply is a "month" message. */
  z.object({ type: z.literal('openMonth'), month: MonthKey }),
  /**
   * Apply one change to a month. The change itself is checked by applyMonthChange()
   * (shared/month/month-changes.ts), so an invalid change is refused with its changeId and
   * the page can drop it.
   */
  z.object({ type: z.literal('change'), changeId: ChangeId, month: MonthKey, change: z.unknown() }),
  /** Send every month; the reply is "exportData". */
  z.object({ type: z.literal('export') }),
  /** Replace these months; the reply is "importDone". Each month is checked by the handler. */
  z.object({ type: z.literal('import'), months: z.array(z.unknown()) }),
]);

export type ClientMessage = z.output<typeof ClientMessageSchema>;

// ----- Durable Object -> page -----

export const ServerMessageSchema = z.discriminatedUnion('type', [
  /**
   * The current version of a month, sent to every device viewing it after any change.
   * appliedChangeId confirms the sender's change.
   */
  z.object({
    type: z.literal('month'),
    month: Month,
    monthKeys: z.array(MonthKey),
    appliedChangeId: z.optional(ChangeId),
  }),
  /** Confirms a change to a sender that no longer views that month. */
  z.object({ type: z.literal('changeApplied'), changeId: ChangeId }),
  z.object({ type: z.literal('exportData'), months: z.array(Month) }),
  z.object({ type: z.literal('importDone'), count: z.number() }),
  /** A request failed. changeId names the refused change, if it was one. */
  z.object({ type: z.literal('error'), message: z.string(), changeId: z.optional(ChangeId) }),
]);

export type ServerMessage = z.output<typeof ServerMessageSchema>;

/** What the server sends; the month is already in saved form. */
export type OutgoingServerMessage =
  | (Omit<Extract<ServerMessage, { type: 'month' }>, 'month'> & { month: MonthData })
  | Exclude<ServerMessage, { type: 'month' }>;

// ----- Reading and writing -----

export class InvalidMessageError extends Error {}

/** Parses a message from the page. @throws {InvalidMessageError} */
export function parseClientMessage(text: string): ClientMessage {
  return parse(ClientMessageSchema, text);
}

/** Parses a message from the server. @throws {InvalidMessageError} */
export function parseServerMessage(text: string): ServerMessage {
  return parse(ServerMessageSchema, text);
}

/** The JSON text to send for a server message. */
export function encodeServerMessage(message: OutgoingServerMessage): string {
  return JSON.stringify(message);
}

/** The JSON text to send for a page message. */
export function encodeClientMessage(message: ClientMessage): string {
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
