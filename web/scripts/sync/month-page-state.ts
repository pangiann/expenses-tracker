import type { RequestBodyInputOf, EndpointName, MonthResponse, PathParamsOf } from '../../../shared/api/endpoints.ts';
import type { Expense, MonthData, MonthRecord } from '../../../shared/month/month-record.ts';
import { ApiError, OfflineError, callEndpoint } from '../api/endpoint-http-client.ts';
import { t } from '../i18n/translator.ts';
import { currentMonthKey } from '../utils/month-keys.ts';
import type { SaveStatusValue } from '../utils/save-status.ts';
import { liveUpdateConnection, type ConnectionRefusal } from './live-update-connection.ts';
import { buildOptimisticMonth } from './optimistic-month.ts';
import { refusedEditMessage } from './refused-edit-message.ts';
import { saveStatusFor } from './save-status.ts';
import { unsavedEditsOutbox, type UnsavedEditsOutboxState } from './unsaved-edits-outbox.ts';

/** Everything the month page shows. A new object every time something changes. */
export interface MonthPageSnapshot {
  /** The month on screen: the saved month with the unsaved edits on top; null while loading. */
  month: MonthRecord | null;
  /** Every saved month, oldest first. */
  savedMonthKeys: readonly string[];
  /** What the save status in the top bar says; null before the first change. */
  saveStatus: SaveStatusValue | null;
  /** The red banner under the top bar, as plain text; null hides it. */
  errorText: string | null;
  /** Why the server didn't save an edit, shown in the same banner until the next edit; null when none. */
  refusedEditText: string | null;
  /** The expense just removed, offered for undo for a few seconds; null when there is none. */
  removedExpense: RemovedExpense | null;
}

/** An expense someone removed, kept whole so that undo can add it back with the same id. */
export interface RemovedExpense {
  monthKey: string;
  expense: Expense;
}

/** String id of the message shown when the server explains why it refused the connection. */
const REFUSAL_STRING_IDS: Record<string, string> = {
  'access-needs-token-settings': 'error.accessNeedsTokenSettings',
  'access-not-enabled': 'error.accessNotEnabled',
  'invalid-sign-in': 'error.invalidSignIn',
  'not-a-member': 'error.notAMember',
};

/**
 * The month page's state, and every way it changes. The page subscribes and draws whatever
 * getSnapshot() returns; nothing else on the page keeps month data.
 *
 * Two months are involved:
 *
 *   saved month    what the server last answered: GET /api/months/:month, an edit's answer,
 *                  or a live update from someone else
 *   month shown    the saved month + the edits not saved yet (optimistic-month.ts)
 *
 * An edit is recorded with recordEdit(): it is kept in the outbox and the month shown is
 * built again at once. When the server saves it, its answer becomes the saved month.
 */
export class MonthPageState {
  #snapshot: MonthPageSnapshot = {
    month: null,
    savedMonthKeys: [],
    saveStatus: null,
    errorText: null,
    refusedEditText: null,
    removedExpense: null,
  };
  readonly #listeners = new Set<() => void>();

  /** The month being shown or loaded. */
  #shownMonthKey: string | null = null;
  /** The server's version of that month, and its revision; older answers are ignored (see MonthResponse). */
  #savedMonth: MonthData | null = null;
  #savedRevision = -1;
  #outboxState: UnsavedEditsOutboxState = { kind: 'idle' };

  /** Calls the listener after every change; returns a function that stops it. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): MonthPageSnapshot => this.#snapshot;

  /**
   * Records an edit someone made on the page, in two steps:
   *   1. keep it in the outbox, which sends it to the server;
   *   2. show it at once, on top of the saved month (an optimistic update).
   * @returns false, and changes nothing, when the edit doesn't match its endpoint (for example an amount of 0)
   */
  recordEdit<Name extends EndpointName>(
    name: Name,
    params: PathParamsOf<Name>,
    body: RequestBodyInputOf<Name>,
  ): boolean {
    if (!unsavedEditsOutbox.add(name, params, body)) return false;
    if (this.#snapshot.refusedEditText) this.#updateSnapshotAndNotifyListeners({ refusedEditText: null });
    this.#showOptimisticMonth();
    return true;
  }

  /** Offers to undo the removal of this expense (see features/undo/undo-toast.tsx). */
  offerUndoForRemovedExpense(removedExpense: RemovedExpense): void {
    this.#updateSnapshotAndNotifyListeners({ removedExpense });
  }

  /** Stops offering the undo: it was used, or its time ran out. */
  dismissUndo(): void {
    if (this.#snapshot.removedExpense) this.#updateSnapshotAndNotifyListeners({ removedExpense: null });
  }

  /** Connects to the server and opens the current month, creating it if needed. */
  async start(): Promise<void> {
    if (location.protocol === 'file:')
      return this.#updateSnapshotAndNotifyListeners({ errorText: t('error.openedAsFile') });

    unsavedEditsOutbox.onSaved = (monthResponse) => this.#showSavedMonth(monthResponse);
    unsavedEditsOutbox.onStateChange = (outboxState) => this.#handleOutboxState(outboxState);
    liveUpdateConnection.onNewerSavedMonth = (monthResponse) => this.#showSavedMonth(monthResponse);
    liveUpdateConnection.onReconnect = () => {
      void this.openMonth(this.#shownMonthKey); // catch up on edits missed while disconnected
      unsavedEditsOutbox.resume();
    };
    liveUpdateConnection.onConnectionChange = () => this.#updateSaveStatus();
    liveUpdateConnection.onRefused = (connectionRefusal) =>
      this.#updateSnapshotAndNotifyListeners({
        errorText: connectionRefusal ? refusalMessage(connectionRefusal) : null,
      });
    liveUpdateConnection.onUnreachable = () =>
      this.#updateSnapshotAndNotifyListeners({ errorText: t('error.cloudUnreachable') });

    liveUpdateConnection.start();
    unsavedEditsOutbox.start();
    await this.openMonth(currentMonthKey());
  }

  /** Loads a month from the server and shows it; from now on, its live updates too. */
  async openMonth(monthKey: string | null): Promise<void> {
    if (!monthKey) return;
    const previousMonthKey = this.#shownMonthKey;
    this.#shownMonthKey = monthKey;
    if (monthKey !== previousMonthKey) this.#savedRevision = -1;
    liveUpdateConnection.watch(monthKey);
    try {
      this.#showSavedMonth(await callEndpoint('getMonth', { month: monthKey }, undefined));
    } catch (error) {
      console.error(error);
      // Stay on the month already shown, if any; the live connection retries on its own.
      if (this.#savedMonth && previousMonthKey) {
        this.#shownMonthKey = previousMonthKey;
        liveUpdateConnection.watch(previousMonthKey);
      }
      if (error instanceof OfflineError)
        this.#updateSnapshotAndNotifyListeners({ errorText: t('error.cloudUnreachable') });
      // 403: the live connection explains why the server refused us.
      else if (!(error instanceof ApiError && error.status === 403))
        this.#updateSnapshotAndNotifyListeners({ errorText: t('error.startFailed') });
    }
  }

  /** Loads the shown month again, for example after an import replaced it. */
  reloadShownMonth(): void {
    this.#savedRevision = -1; // the import saved months without a newer answer for this one
    void this.openMonth(this.#shownMonthKey);
  }

  /** A month the server saved. Answers can arrive out of order, so only a newer revision is used. */
  #showSavedMonth(monthResponse: MonthResponse): void {
    if (monthResponse.month.month !== this.#shownMonthKey || monthResponse.revision < this.#savedRevision) return;
    this.#savedRevision = monthResponse.revision;
    this.#savedMonth = monthResponse.month;
    this.#updateSnapshotAndNotifyListeners({ savedMonthKeys: monthResponse.monthKeys, errorText: null });
    this.#showOptimisticMonth();
  }

  /** Shows the saved month with the edits not saved yet on top. */
  #showOptimisticMonth(): void {
    if (!this.#savedMonth) return;
    this.#updateSnapshotAndNotifyListeners({
      month: buildOptimisticMonth(this.#savedMonth, unsavedEditsOutbox.unsavedEdits),
    });
  }

  #handleOutboxState(outboxState: UnsavedEditsOutboxState): void {
    this.#outboxState = outboxState;
    if (outboxState.kind === 'refused') {
      // For example someone removed the category meanwhile: stop showing the edit, then load
      // the month as it is now.
      console.error('The server refused an edit:', outboxState.error.message);
      this.#updateSnapshotAndNotifyListeners({ refusedEditText: refusedEditMessage(outboxState.error) });
      this.#showOptimisticMonth();
      void this.openMonth(this.#shownMonthKey);
    }
    this.#updateSaveStatus();
  }

  #updateSaveStatus(): void {
    this.#updateSnapshotAndNotifyListeners({
      saveStatus: saveStatusFor(liveUpdateConnection.isConnected, this.#outboxState),
    });
  }

  #updateSnapshotAndNotifyListeners(changes: Partial<MonthPageSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...changes };
    for (const listener of this.#listeners) listener();
  }
}

/** The text explaining why the server refused the connection (see explainSignInStatus in worker/worker-entry-point.ts). */
function refusalMessage({ problem, email, reason }: ConnectionRefusal): string {
  return t(REFUSAL_STRING_IDS[problem] ?? 'error.refused', { email: email ?? '', reason: reason ?? '' });
}

/** The page's one state. */
export const monthPageState = new MonthPageState();
