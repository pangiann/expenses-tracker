import type { MonthResponse } from '../../../shared/api/endpoints.ts';
import type { MonthData, MonthRecord } from '../../../shared/month/month-record.ts';
import { ApiError, OfflineError } from '../api/endpoint-http-client.ts';
import { liveUpdateConnection, type Refusal } from '../api/live-update-connection.ts';
import { monthWithPendingEdits } from '../api/month-with-pending-edits.ts';
import * as monthsApi from '../api/months-api.ts';
import { pendingEditsOutbox, type PendingEditsOutboxState } from '../api/pending-edits-outbox.ts';
import { t } from '../i18n/translator.ts';
import { currentMonthKey } from '../utils/month-keys.ts';
import { SaveStatus, type SaveStatusValue } from '../utils/save-status.ts';

/** Everything the month page shows. A new object every time something changes. */
export interface MonthPageState {
  /** The month on screen: the server's latest version with the pending edits on top; null while loading. */
  month: MonthRecord | null;
  /** Every saved month, oldest first. */
  savedMonthKeys: readonly string[];
  /** What the save status in the top bar says; null before the first change. */
  saveStatus: SaveStatusValue | null;
  /** The red banner under the top bar, as plain text; null hides it. */
  errorText: string | null;
}

/** String id of the message shown when the server explains why it refused the connection. */
const REFUSAL_STRING_IDS: Record<string, string> = {
  'access-needs-token-settings': 'error.accessNeedsTokenSettings',
  'access-not-enabled': 'error.accessNotEnabled',
  'invalid-sign-in': 'error.invalidSignIn',
  'not-a-member': 'error.notAMember',
};

/**
 * The month page's state, and how it changes. The page subscribes and draws whatever
 * getState() returns; nothing else on the page keeps month data.
 *
 * The month on screen is always computed the same way:
 *
 *   the server's latest month   from GET /api/months/:month, an edit's answer, or a live update
 *   + pending edits             edits in the outbox not yet answered (api/month-with-pending-edits.ts)
 *
 * so an edit shows at once, also offline, and the server's version takes over when it answers.
 */
export class MonthPageStore {
  #state: MonthPageState = { month: null, savedMonthKeys: [], saveStatus: null, errorText: null };
  readonly #listeners = new Set<() => void>();

  /** The month being shown or loaded. */
  #shownMonthKey: string | null = null;
  /** The server's version of that month, and its revision; older answers are ignored (see MonthResponse). */
  #serverMonth: MonthData | null = null;
  #shownRevision = -1;
  #outboxState: PendingEditsOutboxState = { kind: 'idle' };

  /** Calls the listener after every change; returns a function that stops it. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = (): MonthPageState => this.#state;

  /** Connects to the server and opens the current month, creating it if needed. */
  async start(): Promise<void> {
    if (location.protocol === 'file:') return this.#update({ errorText: t('error.openedAsFile') });

    pendingEditsOutbox.onAnswer = (answer) => this.#show(answer);
    pendingEditsOutbox.onEditsChange = () => this.#recomputeMonth();
    pendingEditsOutbox.onStateChange = (state) => this.#handleOutboxState(state);
    liveUpdateConnection.onMonth = (answer) => this.#show(answer);
    liveUpdateConnection.onReconnect = () => {
      void this.openMonth(this.#shownMonthKey); // catch up on edits missed while disconnected
      pendingEditsOutbox.resume();
    };
    liveUpdateConnection.onConnectionChange = () => this.#updateSaveStatus();
    liveUpdateConnection.onRefused = (refusal) => this.#update({ errorText: refusal ? refusalMessage(refusal) : null });
    liveUpdateConnection.onUnreachable = () => this.#update({ errorText: t('error.cloudUnreachable') });

    liveUpdateConnection.start();
    pendingEditsOutbox.start();
    await this.openMonth(currentMonthKey());
  }

  /** Loads a month from the server and shows it; from now on, its live updates too. */
  async openMonth(monthKey: string | null): Promise<void> {
    if (!monthKey) return;
    const previousMonthKey = this.#shownMonthKey;
    this.#shownMonthKey = monthKey;
    if (monthKey !== previousMonthKey) this.#shownRevision = -1;
    liveUpdateConnection.watch(monthKey);
    try {
      this.#show(await monthsApi.getMonth(monthKey));
    } catch (error) {
      console.error(error);
      // Stay on the month already shown, if any; the live connection retries on its own.
      if (this.#serverMonth && previousMonthKey) {
        this.#shownMonthKey = previousMonthKey;
        liveUpdateConnection.watch(previousMonthKey);
      }
      if (error instanceof OfflineError) this.#update({ errorText: t('error.cloudUnreachable') });
      // 403: the live connection explains why the server refused us.
      else if (!(error instanceof ApiError && error.status === 403)) this.#update({ errorText: t('error.startFailed') });
    }
  }

  /** Loads the shown month again, for example after an import replaced it. */
  reloadShownMonth(): void {
    this.#shownRevision = -1; // the import saved months without a newer answer for this one
    void this.openMonth(this.#shownMonthKey);
  }

  /** A month from the server. Answers can arrive out of order, so only a newer revision is used. */
  #show(answer: MonthResponse): void {
    if (answer.month.month !== this.#shownMonthKey || answer.revision < this.#shownRevision) return;
    this.#shownRevision = answer.revision;
    this.#serverMonth = answer.month;
    this.#update({
      month: monthWithPendingEdits(answer.month, pendingEditsOutbox.pendingEdits),
      savedMonthKeys: answer.monthKeys,
      errorText: null,
    });
  }

  /** An edit was added to or left the outbox: compute the month on screen again. */
  #recomputeMonth(): void {
    if (!this.#serverMonth) return;
    this.#update({ month: monthWithPendingEdits(this.#serverMonth, pendingEditsOutbox.pendingEdits) });
  }

  #handleOutboxState(state: PendingEditsOutboxState): void {
    this.#outboxState = state;
    if (state.kind === 'refused') {
      // For example someone removed the category meanwhile: show the month as it is now.
      console.error('The server refused an edit:', state.error.message);
      void this.openMonth(this.#shownMonthKey);
    }
    this.#updateSaveStatus();
  }

  #updateSaveStatus(): void {
    const { kind } = this.#outboxState;
    let saveStatus: SaveStatusValue = SaveStatus.SAVED;
    if (!liveUpdateConnection.isConnected || kind === 'offline') saveStatus = SaveStatus.OFFLINE;
    else if (kind === 'sending') saveStatus = SaveStatus.SAVING;
    else if (kind === 'refused') saveStatus = SaveStatus.FAILED;
    this.#update({ saveStatus });
  }

  #update(changes: Partial<MonthPageState>): void {
    this.#state = { ...this.#state, ...changes };
    for (const listener of this.#listeners) listener();
  }
}

/** The text explaining why the server refused the connection (see explainSignInStatus in worker/worker-entry-point.ts). */
function refusalMessage({ problem, email, reason }: Refusal): string {
  return t(REFUSAL_STRING_IDS[problem] ?? 'error.refused', { email: email ?? '', reason: reason ?? '' });
}

/** The page's one store. */
export const monthPageStore = new MonthPageStore();
