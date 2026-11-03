import { isMonthData } from '../../shared/month/month-validation.ts';
import * as categoriesApi from './api/categories-api.ts';
import * as expensesApi from './api/expenses-api.ts';
import { ApiError, InvalidRequestError, OfflineError } from './api/http.ts';
import * as incomeApi from './api/income-api.ts';
import { liveUpdates } from './api/live-updates.ts';
import * as monthsApi from './api/months-api.ts';
import { outbox } from './api/outbox.ts';
import * as recurringCostsApi from './api/recurring-costs-api.ts';
import { monthWithWaitingEdits } from './api/waiting-edits.ts';
import { t, translator } from './i18n/translator.ts';
import { SaveStatus } from './utils/save-status.ts';
import { currentMonthKey, nextMonthKey, todayAsIsoDate } from './utils/month-keys.ts';
import { AddMonthDialog } from './views/AddMonthDialog.js';
import { BackupView } from './views/BackupView.js';
import { BudgetBarsView } from './views/BudgetBarsView.js';
import { CategoryCardsView } from './views/CategoryCardsView.js';
import { IncomeView } from './views/IncomeView.js';
import { LanguageView } from './views/LanguageView.js';
import { MonthNavigationView } from './views/MonthNavigationView.js';
import { QuickAddView } from './views/QuickAddView.js';
import { RecurringCostsView } from './views/RecurringCostsView.js';
import { SpendingDonutView } from './views/SpendingDonutView.js';
import { StatusView } from './views/StatusView.js';
import { SummaryCardsView } from './views/SummaryCardsView.js';

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
    this.statusView = new StatusView();

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
    this.monthNavigationView = new MonthNavigationView(actions);
    this.addMonthDialog = new AddMonthDialog(actions);
    this.backupView = new BackupView(actions);
    this.languageView = new LanguageView(actions);
    this.views = [
      new QuickAddView(actions),
      new SummaryCardsView(actions),
      new BudgetBarsView(),
      new SpendingDonutView(),
      new CategoryCardsView(actions),
      new IncomeView(actions),
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
      // Month navigation
      showPreviousMonth: () => this.#openMonthAtOffset(-1),
      showNextMonth: () => this.#openMonthAtOffset(+1),
      requestNewMonth: () => this.addMonthDialog.open(this.#suggestedNewMonthKey()),
      addMonth: (monthKey) => this.#openMonth(monthKey), // the server creates it when missing

      // Expenses
      addExpense: ({ categoryKey, amount, description, date }) =>
        this.#edit((monthKey) =>
          expensesApi.addExpense(monthKey, { categoryId: categoryKey, amount, description, date }),
        ),
      removeExpense: (expenseId) => this.#edit((monthKey) => expensesApi.removeExpense(monthKey, expenseId)),
      changeExpenseAmount: (expenseId, amount) =>
        this.#edit((monthKey) => expensesApi.changeExpenseAmount(monthKey, expenseId, amount)),

      // Income
      addIncome: (income) => this.#edit((monthKey) => incomeApi.addIncome(monthKey, income)),
      removeIncome: (incomeId) => this.#edit((monthKey) => incomeApi.removeIncome(monthKey, incomeId)),
      changeIncomeAmount: (incomeId, amount) =>
        this.#edit((monthKey) => incomeApi.changeIncomeAmount(monthKey, incomeId, amount)),
      changeExpectedIncome: (amount) => this.#edit((monthKey) => incomeApi.changeExpectedIncome(monthKey, amount)),

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

      // Backups and language
      exportBackup: () => this.#exportBackup(),
      importBackup: (fileText) => this.#importBackup(fileText),
      changeLanguage: (language) => this.#changeLanguage(language),
    };
  }

  /**
   * Sends an edit of the month on screen. The outbox redraws the month with the edit at
   * once, and again with the server's answer.
   * @param {(monthKey: string) => void} sendEdit  calls one API function
   */
  #edit(sendEdit) {
    if (!this.currentMonth) return; // nothing loaded yet, for example while still connecting
    try {
      sendEdit(this.currentMonth.monthKey);
    } catch (error) {
      if (error instanceof InvalidRequestError) return; // for example an empty amount: nothing to send
      throw error;
    }
  }

  /** Draws the server's month with the waiting edits on top. */
  #renderAll() {
    if (!this.serverMonth) return;
    this.currentMonth = monthWithWaitingEdits(this.serverMonth, outbox.waitingEdits);
    this.monthNavigationView.render(this.currentMonth.monthKey, this.savedMonthKeys);
    for (const view of this.views) view.render(this.currentMonth);
  }

  /** Reloads the page in the new language. Edits not yet sent wait in the outbox and survive the reload. */
  #changeLanguage(language) {
    translator.saveLanguage(language);
    location.reload();
  }

  // ----- Backups -----

  async #exportBackup() {
    let months;
    try {
      ({ months } = await monthsApi.exportMonths());
    } catch (error) {
      console.error(error);
      return alert(t('error.cloudUnreachable'));
    }
    const backup = { exportedAt: new Date().toISOString(), months };
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    downloadLink.download = `expenses-backup-${todayAsIsoDate()}.json`;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
  }

  async #importBackup(fileText) {
    let months;
    try {
      months = JSON.parse(fileText).months;
    } catch {
      months = null;
    }
    if (!Array.isArray(months) || months.length === 0 || !months.every(isMonthData)) {
      alert(t('backup.notABackup'));
      return;
    }
    const monthList = months.map((monthData) => monthData.month).sort();
    const confirmation = t('backup.confirmImport', {
      count: months.length,
      first: monthList[0],
      last: monthList[monthList.length - 1],
    });
    if (!confirm(confirmation)) return;

    try {
      await monthsApi.importMonths(months);
    } catch (error) {
      console.error(error);
      return alert(error instanceof OfflineError ? t('error.cloudUnreachable') : t('backup.notABackup'));
    }
    this.shownRevision = -1; // the import saved months without a newer answer for this one
    await this.#openMonth(this.shownMonthKey);
  }

  // ----- Month helpers -----

  #openMonthAtOffset(offset) {
    if (!this.currentMonth) return;
    const position = this.savedMonthKeys.indexOf(this.currentMonth.monthKey);
    const targetMonthKey = this.savedMonthKeys[position + offset];
    if (targetMonthKey) void this.#openMonth(targetMonthKey);
  }

  #suggestedNewMonthKey() {
    const latestMonthKey = this.savedMonthKeys[this.savedMonthKeys.length - 1];
    return latestMonthKey ? nextMonthKey(latestMonthKey) : currentMonthKey();
  }
}

/** The text explaining why the server refused the connection (see describeAccess in worker/index.js). */
function refusalMessage({ problem, email, reason }) {
  return t(REFUSAL_STRING_IDS[problem] ?? 'error.refused', { email: email ?? '', reason: reason ?? '' });
}
