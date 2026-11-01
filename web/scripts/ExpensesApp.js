import { ChangeKind, InvalidChangeError, applyMonthChange } from './model/monthChanges.js';
import { isMonthData } from './model/monthValidation.js';
import { createMonthSync } from './services/createMonthSync.js';
import { createUniqueId } from './utils/ids.js';
import { currentMonthKey, nextMonthKey, todayAsIsoDate } from './utils/monthKeys.js';
import { AddMonthDialog } from './views/AddMonthDialog.js';
import { BackupView } from './views/BackupView.js';
import { BudgetBarsView } from './views/BudgetBarsView.js';
import { CategoryCardsView } from './views/CategoryCardsView.js';
import { MonthNavigationView } from './views/MonthNavigationView.js';
import { QuickAddView } from './views/QuickAddView.js';
import { RecurringCostsView } from './views/RecurringCostsView.js';
import { SpendingDonutView } from './views/SpendingDonutView.js';
import { StatusView } from './views/StatusView.js';
import { SummaryCardsView } from './views/SummaryCardsView.js';

/**
 * Connects the page to the data. Every user action follows the same path:
 *
 *   view event -> action below -> change object -> applyMonthChange() on screen
 *                                               -> sync.sendChange() to storage
 *
 * The sync is LocalMonthSync (Mac app, files on disk) or CloudMonthSync (Cloudflare,
 * shared live). When the stored month changes, the sync calls #showMonth().
 */
export class ExpensesApp {
  constructor() {
    this.statusView = new StatusView();
    this.sync = null;

    /** @type {import('./model/MonthRecord.js').MonthRecord | null} the month on screen */
    this.currentMonth = null;
    /** @type {string[]} saved months, oldest first */
    this.savedMonthKeys = [];

    const actions = this.#createActions();
    this.monthNavigationView = new MonthNavigationView(actions);
    this.addMonthDialog = new AddMonthDialog(actions);
    this.backupView = new BackupView(actions);
    this.views = [
      new QuickAddView(actions),
      new SummaryCardsView(actions),
      new BudgetBarsView(),
      new SpendingDonutView(),
      new CategoryCardsView(actions),
      new RecurringCostsView(actions),
    ];

    window.addEventListener('beforeunload', () => this.sync?.flushWhilePageCloses());
  }

  /** Connects to storage and shows the current month, creating it if needed. */
  async start() {
    if (location.protocol === 'file:') {
      this.monthNavigationView.showTitle('Expenses');
      this.statusView.showError('Open the tracker through its server, not as a file.');
      return;
    }
    try {
      this.sync = await createMonthSync({
        onMonth: (monthRecord, savedMonthKeys) => this.#showMonth(monthRecord, savedMonthKeys),
        onSaveStatus: (saveStatus) => this.statusView.showSaveStatus(saveStatus),
        onConnectionProblem: (message) => this.statusView.showErrorText(message),
      });
      await this.sync.openMonth(currentMonthKey());
    } catch (error) {
      console.error(error);
      this.statusView.showError(this.sync?.startupErrorMessage ?? 'Could not start. Reload the page.');
    }
  }

  /** Called by the Mac app before it quits. */
  async flushPendingSave() {
    await this.sync?.flushPendingChanges();
  }

  #showMonth(monthRecord, savedMonthKeys) {
    this.currentMonth = monthRecord;
    this.savedMonthKeys = savedMonthKeys;
    this.#renderAll();
  }

  // ----- Actions the views can trigger -----

  #createActions() {
    return {
      // Month navigation
      showPreviousMonth: () => this.#openMonthAtOffset(-1),
      showNextMonth: () => this.#openMonthAtOffset(+1),
      requestNewMonth: () => this.addMonthDialog.open(this.#suggestedNewMonthKey()),
      addMonth: (monthKey) => this.sync.openMonth(monthKey), // creates it when missing

      // Expenses
      addExpense: ({ categoryKey, amount, description, date }) => {
        if (!(amount > 0)) return;
        this.#applyChange({
          kind: ChangeKind.ADD_EXPENSE,
          expense: { id: createUniqueId(), categoryKey, amount, description, date },
        });
      },
      removeExpense: (expenseId) => this.#applyChange({ kind: ChangeKind.REMOVE_EXPENSE, expenseId }),
      changeExpenseAmount: (expenseId, amount) =>
        this.#applyChange({ kind: ChangeKind.CHANGE_EXPENSE_AMOUNT, expenseId, amount }),

      // Budgets and income
      changeBudget: (categoryKey, amount) => this.#applyChange({ kind: ChangeKind.CHANGE_BUDGET, categoryKey, amount }),
      changeActualIncome: (amount) => this.#applyChange({ kind: ChangeKind.CHANGE_ACTUAL_INCOME, amount }),
      changeExpectedIncome: (amount) => this.#applyChange({ kind: ChangeKind.CHANGE_EXPECTED_INCOME, amount }),

      // Fixed costs and subscriptions
      addRecurringCost: (listName) => this.#applyChange({ kind: ChangeKind.ADD_RECURRING_COST, listName }),
      removeRecurringCost: (listName, position) =>
        this.#applyChange({ kind: ChangeKind.REMOVE_RECURRING_COST, listName, position }),
      renameRecurringCost: (listName, position, name) =>
        this.#applyChange({ kind: ChangeKind.RENAME_RECURRING_COST, listName, position, name }),
      changeRecurringCostAmount: (listName, position, amount) =>
        this.#applyChange({ kind: ChangeKind.CHANGE_RECURRING_COST_AMOUNT, listName, position, amount }),

      // Backups
      exportBackup: () => this.#exportBackup(),
      importBackup: (fileText) => this.#importBackup(fileText),
    };
  }

  /** Shows the change immediately, then hands it to storage. */
  #applyChange(change) {
    if (!this.currentMonth) return; // nothing loaded yet, for example while still connecting
    try {
      applyMonthChange(this.currentMonth, change);
    } catch (error) {
      if (error instanceof InvalidChangeError) return; // for example an empty amount
      throw error;
    }
    this.#renderAll();
    this.sync.sendChange(this.currentMonth, change);
  }

  #renderAll() {
    this.monthNavigationView.render(this.currentMonth.monthKey, this.savedMonthKeys);
    for (const view of this.views) view.render(this.currentMonth);
  }

  // ----- Backups -----

  async #exportBackup() {
    const months = await this.sync.exportAllMonths();
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
      alert('This file is not an expenses backup.');
      return;
    }
    const monthList = months.map((monthData) => monthData.month).sort();
    const confirmation = `Import ${months.length} months (${monthList[0]} to ${monthList[monthList.length - 1]})?\n`
      + 'Months in the file replace the same months here.';
    if (!confirm(confirmation)) return;

    await this.sync.importMonths(months);
    await this.sync.openMonth(this.currentMonth.monthKey);
  }

  // ----- Month helpers -----

  #openMonthAtOffset(offset) {
    if (!this.currentMonth) return;
    const position = this.savedMonthKeys.indexOf(this.currentMonth.monthKey);
    const targetMonthKey = this.savedMonthKeys[position + offset];
    if (targetMonthKey) this.sync.openMonth(targetMonthKey);
  }

  #suggestedNewMonthKey() {
    const latestMonthKey = this.savedMonthKeys[this.savedMonthKeys.length - 1];
    return latestMonthKey ? nextMonthKey(latestMonthKey) : currentMonthKey();
  }
}
