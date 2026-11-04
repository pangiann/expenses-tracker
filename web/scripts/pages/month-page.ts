import type { MonthRecord } from '../../../shared/month/month-record.ts';
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
import { monthPageStore, type MonthPageState } from './month-page-store.ts';

/** A part of the page that shows the month. */
interface MonthFeature {
  render(month: MonthRecord): void;
}

/**
 * The month page: the only page of the app. It draws the state of month-page-store.ts with
 * every feature (features/) and draws it again whenever the state changes.
 *
 * Each feature handles its own clicks and calls its API functions (api/*-api.ts); for example
 * the category cards call expensesApi.addExpense(). The page never handles an edit itself.
 */
export class MonthPage {
  readonly #statusBar = new StatusBar();
  readonly #monthNavigation = new MonthNavigation((monthKey) => void monthPageStore.openMonth(monthKey));
  readonly #features: MonthFeature[] = [
    new QuickAdd(),
    new SummaryCards(),
    new BudgetBars(),
    new SpendingDonut(),
    new CategoryCards(),
    new IncomeCard(),
    new RecurringCostsPanel(),
  ];
  #drawnState: MonthPageState | null = null;

  constructor() {
    new BackupButtons(() => monthPageStore.reloadShownMonth());
    new LanguagePicker();
  }

  /** Draws on every change of the store, then connects to the server. */
  async start(): Promise<void> {
    monthPageStore.subscribe(() => this.#render(monthPageStore.getState()));
    await monthPageStore.start();
  }

  #render(state: MonthPageState): void {
    const previous = this.#drawnState;
    this.#drawnState = state;
    if (state.saveStatus && state.saveStatus !== previous?.saveStatus) this.#statusBar.showSaveStatus(state.saveStatus);
    if (state.errorText !== previous?.errorText) this.#statusBar.showError(state.errorText);
    if (state.month && (state.month !== previous?.month || state.savedMonthKeys !== previous.savedMonthKeys)) {
      this.#monthNavigation.render(state.month.monthKey, state.savedMonthKeys);
      for (const feature of this.#features) feature.render(state.month);
    }
  }
}
