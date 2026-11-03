import type { MonthResponse } from '../../../shared/api/endpoints.ts';
import type { MonthData, MonthRecord } from '../../../shared/month/month-record.ts';
import { ApiError, OfflineError } from '../api/http.ts';
import { liveUpdates, type Refusal } from '../api/live-updates.ts';
import * as monthsApi from '../api/months-api.ts';
import { outbox, type OutboxState } from '../api/outbox.ts';
import { monthWithWaitingEdits } from '../api/waiting-edits.ts';
import { BackupButtons } from '../features/backup/backup-buttons.ts';
import { CategoryCards } from '../features/categories/category-cards.ts';
import { IncomeCard } from '../features/income/income-card.ts';
import { LanguagePicker } from '../features/language/language-picker.ts';
import { MonthNavigation } from '../features/month-navigation/month-navigation.ts';
import { QuickAdd } from '../features/quick-add/quick-add.ts';
import { RecurringCostsPanel } from '../features/recurring-costs/recurring-costs-panel.ts';
import { StatusBar } from '../features/status/status-bar.ts';
import { BudgetBars } from '../features/summary/budget-bars.ts';
import { SpendingDonut } from '../features/summary/spending-donut.ts';
import { SummaryCards } from '../features/summary/summary-cards.ts';
import { t } from '../i18n/translator.ts';
import { currentMonthKey } from '../utils/month-keys.ts';
import { SaveStatus } from '../utils/save-status.ts';

/** A part of the page that shows the month. */
interface MonthFeature {
  render(month: MonthRecord): void;
}

/** String id of the message shown when the server explains why it refused the connection. */
const REFUSAL_STRING_IDS: Record<string, string> = {
  'access-needs-token-settings': 'error.accessNeedsTokenSettings',
  'access-not-enabled': 'error.accessNotEnabled',
  'invalid-sign-in': 'error.invalidSignIn',
  'not-a-member': 'error.notAMember',
};

/**
 * The month page: the only page of the app. It loads a month from the server, draws it with
 * every feature (features/), and draws it again whenever it changes.
 *
 * Each feature handles its own clicks and calls its API functions (api/*-api.ts); for example
 * the category cards call expensesApi.addExpense(). The page never handles an edit itself.
 * It only decides what to draw:
 *
 *   the server's latest month   from GET /api/months/:month, an edit's answer, or a live update
 *   + waiting edits             edits in the outbox not yet answered (api/waiting-edits.ts)
 *
 * so an edit shows at once, also offline, and the server's version takes over when it answers.
 */
export class MonthPage {
  readonly #statusBar = new StatusBar();
  readonly #monthNavigation = new MonthNavigation((monthKey) => void this.#openMonth(monthKey));
  readonly #features: MonthFeature[] = [
    new QuickAdd(),
    new SummaryCards(),
    new BudgetBars(),
    new SpendingDonut(),
    new CategoryCards(),
    new IncomeCard(),
    new RecurringCostsPanel(),
  ];

  /** The month being shown or loaded. */
  #shownMonthKey: string | null = null;
  /** The server's version of that month, and its revision; older answers are ignored (see MonthResponse). */
  #serverMonth: MonthData | null = null;
  #shownRevision = -1;
  /** Every saved month, oldest first. */
  #savedMonthKeys: string[] = [];
  #outboxState: OutboxState = { kind: 'idle' };

  constructor() {
    new BackupButtons(() => {
      this.#shownRevision = -1; // the import saved months without a newer answer for this one
      void this.#openMonth(this.#shownMonthKey);
    });
    new LanguagePicker();
  }

  /** Connects to the server and shows the current month, creating it if needed. */
  async start(): Promise<void> {
    if (location.protocol === 'file:') return this.#statusBar.showError(t('error.openedAsFile'));

    outbox.onAnswer = (answer) => this.#show(answer);
    outbox.onEditsChange = () => this.#render();
    outbox.onStateChange = (state) => this.#handleOutboxState(state);
    liveUpdates.onMonth = (answer) => this.#show(answer);
    liveUpdates.onReconnect = () => {
      void this.#openMonth(this.#shownMonthKey); // catch up on edits missed while disconnected
      outbox.resume();
    };
    liveUpdates.onConnectionChange = () => this.#showSaveStatus();
    liveUpdates.onRefused = (refusal) => this.#statusBar.showError(refusal ? refusalMessage(refusal) : null);
    liveUpdates.onUnreachable = () => this.#statusBar.showError(t('error.cloudUnreachable'));

    liveUpdates.start();
    outbox.start();
    await this.#openMonth(currentMonthKey());
  }

  /** Loads a month from the server and shows it; from now on, its live updates too. */
  async #openMonth(monthKey: string | null): Promise<void> {
    if (!monthKey) return;
    const previousMonthKey = this.#shownMonthKey;
    this.#shownMonthKey = monthKey;
    if (monthKey !== previousMonthKey) this.#shownRevision = -1;
    liveUpdates.watch(monthKey);
    try {
      this.#show(await monthsApi.getMonth(monthKey));
    } catch (error) {
      console.error(error);
      // Stay on the month already shown, if any; the live connection retries on its own.
      if (this.#serverMonth && previousMonthKey) {
        this.#shownMonthKey = previousMonthKey;
        liveUpdates.watch(previousMonthKey);
      }
      if (error instanceof OfflineError) this.#statusBar.showError(t('error.cloudUnreachable'));
      // 403: the live connection explains why the server refused us.
      else if (!(error instanceof ApiError && error.status === 403)) this.#statusBar.showError(t('error.startFailed'));
    }
  }

  /** A month from the server. Answers can arrive out of order, so only a newer revision is used. */
  #show(answer: MonthResponse): void {
    if (answer.month.month !== this.#shownMonthKey || answer.revision < this.#shownRevision) return;
    this.#shownRevision = answer.revision;
    this.#serverMonth = answer.month;
    this.#savedMonthKeys = answer.monthKeys;
    this.#statusBar.showError(null);
    this.#render();
  }

  /** Draws the server's month with the waiting edits on top. */
  #render(): void {
    if (!this.#serverMonth) return;
    const month = monthWithWaitingEdits(this.#serverMonth, outbox.waitingEdits);
    this.#monthNavigation.render(month.monthKey, this.#savedMonthKeys);
    for (const feature of this.#features) feature.render(month);
  }

  #handleOutboxState(state: OutboxState): void {
    this.#outboxState = state;
    if (state.kind === 'refused') {
      // For example someone removed the category meanwhile: show the month as it is now.
      console.error('The server refused an edit:', state.error.message);
      void this.#openMonth(this.#shownMonthKey);
    }
    this.#showSaveStatus();
  }

  #showSaveStatus(): void {
    const { kind } = this.#outboxState;
    if (!liveUpdates.isConnected || kind === 'offline') return this.#statusBar.showSaveStatus(SaveStatus.OFFLINE);
    if (kind === 'sending') return this.#statusBar.showSaveStatus(SaveStatus.SAVING);
    if (kind === 'refused') return this.#statusBar.showSaveStatus(SaveStatus.FAILED);
    this.#statusBar.showSaveStatus(SaveStatus.SAVED);
  }
}

/** The text explaining why the server refused the connection (see describeAccess in worker/index.js). */
function refusalMessage({ problem, email, reason }: Refusal): string {
  return t(REFUSAL_STRING_IDS[problem] ?? 'error.refused', { email: email ?? '', reason: reason ?? '' });
}
