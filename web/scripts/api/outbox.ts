import type { BodyInputOf, EndpointName, MonthResponse, ParamsOf } from '../../../shared/api/endpoints.ts';
import { ApiError, OfflineError, callEndpoint, checkBody } from './http.ts';

/** An edit waiting to be sent, kept in localStorage while offline. */
interface OutgoingEdit {
  name: EndpointName;
  params: Record<string, string>;
  body: unknown;
}

export type OutboxState =
  /** nothing waiting */
  | { kind: 'idle' }
  /** an edit is on its way */
  | { kind: 'sending'; waiting: number }
  /** the server can't be reached; edits are kept and sent later */
  | { kind: 'offline'; waiting: number }
  /** the server refused the last edit (for example someone removed the category meanwhile) */
  | { kind: 'refused'; error: ApiError };

const STORAGE_KEY = 'expenses.outbox';
const RETRY_DELAY_MS = 5_000;

/**
 * Sends the page's edits to the server one at a time, in the order they were made, so a
 * later edit never overtakes an earlier one. Every answer (the month after the edit) goes
 * to onAnswer, which shows it.
 *
 * Without a connection, edits wait here and in localStorage, so they survive a closed tab,
 * and are sent when the connection is back. Sending an edit twice is harmless: new items
 * carry the id the page gave them.
 */
export class Outbox {
  onAnswer: (answer: MonthResponse) => void = () => {};
  onStateChange: (state: OutboxState) => void = () => {};

  #edits: OutgoingEdit[] = loadEdits();
  #isSending = false;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Edits made before the page was last closed are sent right away. */
  start(): void {
    window.addEventListener('online', () => this.resume());
    this.resume();
  }

  /**
   * Queues an edit and starts sending.
   * @throws {InvalidRequestError} at once, when the edit doesn't match its endpoint
   */
  send<Name extends EndpointName>(name: Name, params: ParamsOf<Name>, body: BodyInputOf<Name>): void {
    checkBody(name, body);
    this.#edits.push({ name, params, body });
    saveEdits(this.#edits);
    void this.#sendWaitingEdits();
  }

  /** Tries again now, for example when the live connection is back. */
  resume(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    void this.#sendWaitingEdits();
  }

  get waitingCount(): number {
    return this.#edits.length;
  }

  async #sendWaitingEdits(): Promise<void> {
    if (this.#isSending) return;
    this.#isSending = true;
    try {
      let edit: OutgoingEdit | undefined;
      while ((edit = this.#edits[0])) {
        this.onStateChange({ kind: 'sending', waiting: this.#edits.length });
        try {
          const answer = await callEndpoint(edit.name, edit.params as never, edit.body as never);
          this.#dropFirst();
          this.onAnswer(answer as MonthResponse);
        } catch (error) {
          if (error instanceof OfflineError) {
            this.onStateChange({ kind: 'offline', waiting: this.#edits.length });
            this.#retryTimer = setTimeout(() => this.resume(), RETRY_DELAY_MS);
            return;
          }
          // Refused for good: sending it again won't help, so drop it and say so.
          this.#dropFirst();
          if (!(error instanceof ApiError)) throw error;
          this.onStateChange({ kind: 'refused', error });
          continue;
        }
      }
      this.onStateChange({ kind: 'idle' });
    } finally {
      this.#isSending = false;
    }
  }

  #dropFirst(): void {
    this.#edits.shift();
    saveEdits(this.#edits);
  }
}

function loadEdits(): OutgoingEdit[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter(isOutgoingEdit) : [];
  } catch {
    return []; // storage blocked or corrupt: start empty
  }
}

function saveEdits(edits: OutgoingEdit[]): void {
  try {
    if (edits.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    /* storage blocked (for example private browsing): edits live only in memory */
  }
}

function isOutgoingEdit(value: unknown): value is OutgoingEdit {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'params' in value &&
    typeof value.params === 'object'
  );
}

/** The page's one outbox. */
export const outbox = new Outbox();
