import type { RequestBodyInputOf, EndpointName, MonthResponse, PathParamsOf } from '../../../shared/api/endpoints.ts';
import { ApiError, OfflineError, callEndpoint, isValidBody } from '../api/endpoint-http-client.ts';

/** An edit the server hasn't saved yet. */
export interface UnsavedEdit {
  name: EndpointName;
  params: Record<string, string>;
  body: unknown;
}

export type UnsavedEditsOutboxState =
  /** nothing waiting */
  | { kind: 'idle' }
  /** an edit is on its way */
  | { kind: 'sending'; waiting: number }
  /** the server can't be reached; edits are kept and sent later */
  | { kind: 'offline'; waiting: number }
  /** the server refused the last edit (for example someone removed the category meanwhile) */
  | { kind: 'refused'; error: ApiError };

// Unchanged since the first version, so edits saved in a browser before an update are still sent.
const UNSAVED_EDITS_STORAGE_KEY = 'expenses.outbox';
const RETRY_DELAY_MS = 5_000;

/**
 * Holds the edits the server hasn't saved yet and sends them one at a time, in the order
 * they were made, so a later edit never overtakes an earlier one. Every answer (the month
 * after the edit) goes to onSaved; an edit the server refuses goes to onStateChange.
 *
 * Without a connection, edits wait here and in localStorage, so they survive a closed tab,
 * and are sent when the connection is back. Sending an edit twice is harmless: new items
 * carry the id the page gave them. While edits wait, the page shows them on top of the saved
 * month (optimistic-month.ts).
 */
export class UnsavedEditsOutbox {
  /** The server saved the oldest edit; the answer is the month after it. */
  onSaved: (monthResponse: MonthResponse) => void = () => {};
  onStateChange: (outboxState: UnsavedEditsOutboxState) => void = () => {};

  #edits: UnsavedEdit[] = loadUnsavedEditsFromBrowser();
  #isSending = false;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Edits made before the page was last closed are sent right away. */
  start(): void {
    window.addEventListener('online', () => this.resume());
    this.resume();
  }

  /**
   * Keeps an edit and starts sending it.
   * @returns false, and keeps nothing, when the edit doesn't match its endpoint (for example an amount of 0)
   */
  add<Name extends EndpointName>(name: Name, params: PathParamsOf<Name>, body: RequestBodyInputOf<Name>): boolean {
    if (!isValidBody(name, body)) return false;
    this.#edits.push({ name, params, body });
    saveUnsavedEditsToBrowser(this.#edits);
    void this.#sendUnsavedEdits();
    return true;
  }

  /** Tries again now, for example when the live connection is back. */
  resume(): void {
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    void this.#sendUnsavedEdits();
  }

  get unsavedEditCount(): number {
    return this.#edits.length;
  }

  /** The edits the server hasn't saved yet, oldest first. */
  get unsavedEdits(): readonly UnsavedEdit[] {
    return this.#edits;
  }

  async #sendUnsavedEdits(): Promise<void> {
    if (this.#isSending) return;
    this.#isSending = true;
    try {
      let edit: UnsavedEdit | undefined;
      while ((edit = this.#edits[0])) {
        this.onStateChange({ kind: 'sending', waiting: this.#edits.length });
        try {
          const monthResponse = await callEndpoint(edit.name, edit.params as never, edit.body as never);
          this.#removeOldestUnsavedEdit();
          this.onSaved(monthResponse as MonthResponse);
        } catch (error) {
          if (error instanceof OfflineError) {
            this.onStateChange({ kind: 'offline', waiting: this.#edits.length });
            this.#retryTimer = setTimeout(() => this.resume(), RETRY_DELAY_MS);
            return;
          }
          // Refused for good: sending it again won't help, so drop it and say so.
          this.#removeOldestUnsavedEdit();
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

  #removeOldestUnsavedEdit(): void {
    this.#edits.shift();
    saveUnsavedEditsToBrowser(this.#edits);
  }
}

function loadUnsavedEditsFromBrowser(): UnsavedEdit[] {
  try {
    const storedUnsavedEdits: unknown = JSON.parse(localStorage.getItem(UNSAVED_EDITS_STORAGE_KEY) ?? '[]');
    return Array.isArray(storedUnsavedEdits) ? storedUnsavedEdits.filter(isUnsavedEdit) : [];
  } catch {
    return []; // storage blocked or corrupt: start empty
  }
}

function saveUnsavedEditsToBrowser(edits: UnsavedEdit[]): void {
  try {
    if (edits.length === 0) localStorage.removeItem(UNSAVED_EDITS_STORAGE_KEY);
    else localStorage.setItem(UNSAVED_EDITS_STORAGE_KEY, JSON.stringify(edits));
  } catch {
    /* storage blocked (for example private browsing): edits live only in memory */
  }
}

function isUnsavedEdit(value: unknown): value is UnsavedEdit {
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
export const unsavedEditsOutbox = new UnsavedEditsOutbox();
