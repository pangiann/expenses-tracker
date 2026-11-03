import * as categoriesApi from './api/categories-api.ts';
import * as expensesApi from './api/expenses-api.ts';
import { ApiError, OfflineError } from './api/http.ts';
import { liveUpdates } from './api/live-updates.ts';
import * as monthsApi from './api/months-api.ts';
import { outbox } from './api/outbox.ts';
import * as recurringCostsApi from './api/recurring-costs-api.ts';
import { monthWithWaitingEdits } from './api/waiting-edits.ts';
import { BackupButtons } from './features/backup/backup-buttons.ts';
import { IncomeCard } from './features/income/income-card.ts';
import { LanguagePicker } from './features/language/language-picker.ts';
import { MonthNavigation } from './features/month-navigation/month-navigation.ts';
import { QuickAdd } from './features/quick-add/quick-add.ts';
import { StatusBar } from './features/status/status-bar.ts';
import { BudgetBars } from './features/summary/budget-bars.ts';
import { SpendingDonut } from './features/summary/spending-donut.ts';
import { SummaryCards } from './features/summary/summary-cards.ts';
import { t } from './i18n/translator.ts';
import { SaveStatus } from './utils/save-status.ts';
import { currentMonthKey } from './utils/month-keys.ts';
import { CategoryCardsView } from './views/CategoryCardsView.js';
import { RecurringCostsView } from './views/RecurringCostsView.js';

/** String id of the message shown when the server explains why it refused the connection. */
const REFUSAL_STRING_IDS = {
  'access-needs-token-settings': 'error.accessNeedsTokenSettings',
  'access-not-enabled': 'error.accessNotEnabled',
  'invalid-sign-in': 'error.invalidSignIn',
  'not-a-member': 'error.notAMember',
};

/**
 * Connects the page to the server. Every user action follows the same path:
 *
 *   view event -> action below -> API function (api/*-api.ts) -> HTTP request
 *     -> the server saves the edit and answers with the month -> #show() draws it
 *
 * The screen shows the server's last answer with the edits still waiting in the outbox
 * applied on top (api/waiting-edits.ts), so an edit shows at once, also without a
 * connection; the outbox sends it when it can (api/outbox.ts). Other people's edits arrive
 * through the live connection (api/live-updates.ts) and also go to #show().
 */
export class ExpensesApp {
  constructor() {
    this.statusView = new StatusBar();

    /** @type {import('../../shared/month/month-record.ts').MonthData | null} the server's version of the month */
    this.serverMonth = null;
    /** @type {import('../../shared/month/month-record.ts').MonthRecord | null} the month on screen */
    this.currentMonth = null;
    /** @type {string | null} the month being shown or loaded */
    this.shownMonthKey = null;
    /** revision of the month on screen; older answers are ignored (see MonthResponse) */
    this.shownRevision = -1;
    /** @type {string[]} saved months, oldest first */
    this.savedMonthKeys = [];
    this.outboxState = { kind: 'idle' };

    const actions = this.#createActions();
    this.monthNavigation = new MonthNavigation((monthKey) => void this.#openMonth(monthKey));
    new BackupButtons(() => {
      this.shownRevision = -1; // the import saved months without a newer answer for this one
      void this.#openMonth(this.shownMonthKey);
    });
    new LanguagePicker();
    this.views = [
      new QuickAdd(),
      new SummaryCards(),
      new BudgetBars(),
      new SpendingDonut(),
      new CategoryCardsView(actions),
      new IncomeCard(),
      new RecurringCostsView(actions),
    ];
  }

  /** Connects to the server and shows the current month, creating it if needed. */
  async start() {
    if (location.protocol === 'file:') {
      this.statusView.showError(t('error.openedAsFile'));
      return;
    }
    outbox.onAnswer = (answer) => this.#show(answer);
    outbox.onStateChange = (state) => this.#handleOutboxState(state);
    outbox.onEditsChange = () => this.#renderAll();
    liveUpdates.onMonth = (answer) => this.#show(answer);
    liveUpdates.onReconnect = () => {
      void this.#openMonth(this.shownMonthKey); // catch up on edits missed while disconnected
      outbox.resume();
    };
    liveUpdates.onConnectionChange = () => this.#showSaveStatus();
    liveUpdates.onRefused = (refusal) => this.statusView.showError(refusal ? refusalMessage(refusal) : null);
    liveUpdates.onUnreachable = () => this.statusView.showError(t('error.cloudUnreachable'));

    liveUpdates.start();
    outbox.start();
    await this.#openMonth(currentMonthKey());
  }

  /** Loads a month from the server and shows it; from now on, its live updates too. */
  async #openMonth(monthKey) {
    if (!monthKey) return;
    const previousMonthKey = this.shownMonthKey;
    this.shownMonthKey = monthKey;
    if (monthKey !== previousMonthKey) this.shownRevision = -1;
    liveUpdates.watch(monthKey);
    try {
      this.#show(await monthsApi.getMonth(monthKey));
    } catch (error) {
      console.error(error);
      // Stay on the month already shown, if any; the live connection retries on its own.
      if (this.currentMonth && previousMonthKey) {
        this.shownMonthKey = previousMonthKey;
        liveUpdates.watch(previousMonthKey);
      }
      if (error instanceof OfflineError) this.statusView.showError(t('error.cloudUnreachable'));
      else if (!(error instanceof ApiError && error.status === 403)) this.statusView.showError(t('error.startFailed'));
      // 403: the live connection explains why the server refused us.
    }
  }

  /**
   * Draws a month the server sent: an answer to an edit, the answer to opening a month, or
   * a live update. Answers can arrive out of order, so only a newer revision is drawn.
   * @param {import('../../shared/api/endpoints.ts').MonthResponse} answer
   */
  #show(answer) {
    if (answer.month.month !== this.shownMonthKey || answer.revision < this.shownRevision) return;
    this.shownRevision = answer.revision;
    this.serverMonth = answer.month;
    this.savedMonthKeys = answer.monthKeys;
    this.statusView.showError(null);
    this.#renderAll();
  }

  #handleOutboxState(state) {
    this.outboxState = state;
    if (state.kind === 'refused') {
      // For example someone removed the category meanwhile: show the month as it is now.
      console.error('The server refused an edit:', state.error.message);
      void this.#openMonth(this.shownMonthKey);
    }
    this.#showSaveStatus();
  }

  #showSaveStatus() {
    const { kind } = this.outboxState;
    if (!liveUpdates.isConnected || kind === 'offline') return this.statusView.showSaveStatus(SaveStatus.OFFLINE);
    if (kind === 'sending') return this.statusView.showSaveStatus(SaveStatus.SAVING);
    if (kind === 'refused') return this.statusView.showSaveStatus(SaveStatus.FAILED);
    this.statusView.showSaveStatus(SaveStatus.SAVED);
  }

  // ----- Actions the views can trigger -----

  #createActions() {
    return {
      // Expenses
      addExpense: ({ categoryKey, amount, description, date }) =>
        this.#edit((monthKey) =>
          expensesApi.addExpense(monthKey, { categoryId: categoryKey, amount, description, date }),
        ),
      removeExpense: (expenseId) => this.#edit((monthKey) => expensesApi.removeExpense(monthKey, expenseId)),
      changeExpenseAmount: (expenseId, amount) =>
        this.#edit((monthKey) => expensesApi.changeExpenseAmount(monthKey, expenseId, amount)),

      // Categories and budgets
      addCategory: (name) =>
        this.#edit((monthKey) =>
          categoriesApi.addCategory(monthKey, { name, color: this.currentMonth.pickCategoryColor() }),
        ),
      renameCategory: (categoryId, name) =>
        this.#edit((monthKey) => categoriesApi.renameCategory(monthKey, categoryId, name)),
      removeCategory: (categoryId) => this.#edit((monthKey) => categoriesApi.removeCategory(monthKey, categoryId)),
      moveCategory: (categoryId, beforeCategoryId) =>
        this.#edit((monthKey) => categoriesApi.moveCategory(monthKey, categoryId, beforeCategoryId)),
      changeBudget: (categoryKey, amount) =>
        this.#edit((monthKey) => categoriesApi.changeBudget(monthKey, categoryKey, amount)),

      // Fixed costs and subscriptions
      addRecurringCost: (listName) =>
        this.#edit((monthKey) => recurringCostsApi.addRecurringCost(monthKey, listName, t('recurring.newItem'))),
      removeRecurringCost: (listName, costId) =>
        this.#edit((monthKey) => recurringCostsApi.removeRecurringCost(monthKey, listName, costId)),
      renameRecurringCost: (listName, costId, name) =>
        this.#edit((monthKey) => recurringCostsApi.renameRecurringCost(monthKey, listName, costId, name)),
      changeRecurringCostAmount: (listName, costId, amount) =>
        this.#edit((monthKey) => recurringCostsApi.changeRecurringCostAmount(monthKey, listName, costId, amount)),
    };
  }

  /**
   * Sends an edit of the month on screen. The outbox redraws the month with the edit at
   * once, and again with the server's answer.
   * @param {(monthKey: string) => void} sendEdit  calls one API function
   */
  #edit(sendEdit) {
    if (!this.currentMonth) return; // nothing loaded yet, for example while still connecting
    sendEdit(this.currentMonth.monthKey); // an invalid edit, for example an empty amount, is not sent
  }

  /** Draws the server's month with the waiting edits on top. */
  #renderAll() {
    if (!this.serverMonth) return;
    this.currentMonth = monthWithWaitingEdits(this.serverMonth, outbox.waitingEdits);
    this.monthNavigation.render(this.currentMonth.monthKey, this.savedMonthKeys);
    for (const view of this.views) view.render(this.currentMonth);
  }
}

/** The text explaining why the server refused the connection (see describeAccess in worker/index.js). */
function refusalMessage({ problem, email, reason }) {
  return t(REFUSAL_STRING_IDS[problem] ?? 'error.refused', { email: email ?? '', reason: reason ?? '' });
}
