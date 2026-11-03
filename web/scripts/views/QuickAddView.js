import { categoryName } from '../i18n/Translator.js';
import { escapeHtml, getElement } from '../utils/html.js';
import { parseAmount } from '../utils/money.js';
import { defaultExpenseDate, monthDateRange } from '../utils/monthKeys.js';

/** The "Add expense" bar: amount, description, category, date. */
export class QuickAddView {
  /**
   * @param {object} actions
   * @param {(expense: {categoryKey: string, amount: number, description: string, date: string}) => void} actions.addExpense
   */
  constructor(actions) {
    this.form = getElement('quickAddForm');
    this.amountInput = getElement('quickAddAmount');
    this.descriptionInput = getElement('quickAddDescription');
    this.categorySelect = getElement('quickAddCategory');
    this.dateInput = getElement('quickAddDate');
    this.shownMonthKey = null;
    this.shownCategoryOptions = '';

    this.form.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      actions.addExpense({
        categoryKey: this.categorySelect.value,
        amount: parseAmount(this.amountInput.value),
        description: this.descriptionInput.value,
        date: this.dateInput.value || defaultExpenseDate(this.shownMonthKey),
      });
      this.amountInput.value = '';
      this.descriptionInput.value = '';
      this.amountInput.focus();
    });
  }

  render(monthRecord) {
    this.#renderCategoryOptions(monthRecord.categories);
    this.#renderDateLimits(monthRecord);
  }

  /** The category menu follows the month's list; the chosen category stays selected if it still exists. */
  #renderCategoryOptions(categories) {
    const optionsHtml = categories
      .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(categoryName(category))}</option>`)
      .join('');
    if (optionsHtml === this.shownCategoryOptions) return;
    const selectedCategoryId = this.categorySelect.value;
    this.categorySelect.innerHTML = optionsHtml;
    this.shownCategoryOptions = optionsHtml;
    if (categories.some((category) => category.id === selectedCategoryId))
      this.categorySelect.value = selectedCategoryId;
  }

  /** Limits the date picker to the month on screen. */
  #renderDateLimits(monthRecord) {
    if (this.shownMonthKey === monthRecord.monthKey) return; // keep the date the user picked
    this.shownMonthKey = monthRecord.monthKey;
    const { firstDay, lastDay } = monthDateRange(monthRecord.monthKey);
    this.dateInput.min = firstDay;
    this.dateInput.max = lastDay;
    this.dateInput.value = defaultExpenseDate(monthRecord.monthKey);
  }
}
