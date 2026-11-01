import { SPENDING_CATEGORIES } from '../config/categories.js';
import { getElement } from '../utils/html.js';
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

    this.categorySelect.innerHTML = SPENDING_CATEGORIES
      .map((category) => `<option value="${category.key}">${category.displayName}</option>`)
      .join('');

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

  /** Limits the date picker to the month on screen. */
  render(monthRecord) {
    if (this.shownMonthKey === monthRecord.monthKey) return; // keep the date the user picked
    this.shownMonthKey = monthRecord.monthKey;
    const { firstDay, lastDay } = monthDateRange(monthRecord.monthKey);
    this.dateInput.min = firstDay;
    this.dateInput.max = lastDay;
    this.dateInput.value = defaultExpenseDate(monthRecord.monthKey);
  }
}
