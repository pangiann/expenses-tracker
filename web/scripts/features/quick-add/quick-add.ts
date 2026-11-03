import type { Category } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import { categoryName } from '../../i18n/translator.ts';
import { escapeHtml, getElement } from '../../utils/html.ts';
import { parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate, monthDateRange } from '../../utils/month-keys.ts';

/**
 * The "Add expense" bar: amount, description, category, date.
 * Submitting adds the expense (POST /api/months/:month/expenses), the same as the form in a
 * category card.
 */
export class QuickAdd {
  readonly #form = getElement('quickAddForm', HTMLFormElement);
  readonly #amountInput = getElement('quickAddAmount', HTMLInputElement);
  readonly #descriptionInput = getElement('quickAddDescription', HTMLInputElement);
  readonly #categorySelect = getElement('quickAddCategory', HTMLSelectElement);
  readonly #dateInput = getElement('quickAddDate', HTMLInputElement);
  #month: MonthRecord | null = null;
  #shownMonthKey: string | null = null;
  #shownCategoryOptions = '';

  constructor() {
    this.#form.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      if (!this.#month) return;
      const isSent = expensesApi.addExpense(this.#month.monthKey, {
        categoryId: this.#categorySelect.value,
        amount: parseAmount(this.#amountInput.value) ?? 0,
        description: this.#descriptionInput.value,
        date: this.#dateInput.value || defaultExpenseDate(this.#month.monthKey),
      });
      if (!isSent) return; // for example no amount: keep what was typed
      this.#amountInput.value = '';
      this.#descriptionInput.value = '';
      this.#amountInput.focus();
    });
  }

  render(month: MonthRecord): void {
    this.#month = month;
    this.#renderCategoryOptions(month.categories);
    this.#renderDateLimits(month);
  }

  /** The category menu follows the month's list; the chosen category stays selected if it still exists. */
  #renderCategoryOptions(categories: readonly Category[]): void {
    const optionsHtml = categories
      .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(categoryName(category))}</option>`)
      .join('');
    if (optionsHtml === this.#shownCategoryOptions) return;
    const selectedCategoryId = this.#categorySelect.value;
    this.#categorySelect.innerHTML = optionsHtml;
    this.#shownCategoryOptions = optionsHtml;
    if (categories.some((category) => category.id === selectedCategoryId)) {
      this.#categorySelect.value = selectedCategoryId;
    }
  }

  /** Limits the date picker to the month on screen. */
  #renderDateLimits(month: MonthRecord): void {
    if (this.#shownMonthKey === month.monthKey) return; // keep the date the user picked
    this.#shownMonthKey = month.monthKey;
    const { firstDay, lastDay } = monthDateRange(month.monthKey);
    this.#dateInput.min = firstDay;
    this.#dateInput.max = lastDay;
    this.#dateInput.value = defaultExpenseDate(month.monthKey);
  }
}
