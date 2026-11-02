import { getElement } from '../utils/html.js';
import { formatEuros, parseAmount } from '../utils/money.js';
import { defaultExpenseDate } from '../utils/monthKeys.js';
import { InlineNumberEditor } from './InlineNumberEditor.js';
import { renderEntryRows } from './entryRows.js';

/**
 * The Income card: every amount earned this month (salary, each private lesson, ...),
 * with the total at the top. It works like a category card: add with the form at the
 * bottom, click an amount to change it, ✕ to remove it.
 */
export class IncomeView {
  /**
   * @param {object} actions
   * @param {(income: {amount: number, description: string, date: string}) => void} actions.addIncome
   * @param {(incomeId: string) => void} actions.removeIncome
   * @param {(incomeId: string, amount: number) => void} actions.changeIncomeAmount
   */
  constructor(actions) {
    this.actions = actions;
    this.totalElement = getElement('incomeTotal');
    this.listElement = getElement('incomeList');
    this.addForm = getElement('incomeAddForm');
    this.monthRecord = null;

    this.addForm.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      this.actions.addIncome({
        amount: parseAmount(this.addForm.elements.amount.value),
        description: this.addForm.elements.description.value,
        date: defaultExpenseDate(this.monthRecord.monthKey),
      });
      this.addForm.reset();
      this.addForm.elements.amount.focus();
    });
    this.listElement.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(monthRecord) {
    this.monthRecord = monthRecord;
    this.totalElement.textContent = formatEuros(monthRecord.totalIncome);
    this.listElement.innerHTML = renderEntryRows(monthRecord.incomesNewestFirst(), 'income.untitled');
  }

  #handleClick(clickEvent) {
    const deleteButton = clickEvent.target.closest('.delete-button');
    if (deleteButton) {
      this.actions.removeIncome(deleteButton.dataset.entryId);
      return;
    }
    const amountElement = clickEvent.target.closest('.entry-amount');
    if (amountElement) {
      const incomeId = amountElement.dataset.entryId;
      InlineNumberEditor.open(amountElement, {
        currentValue: this.monthRecord.findIncome(incomeId).amount,
        onSave: (newAmount) => this.actions.changeIncomeAmount(incomeId, newAmount),
      });
    }
  }
}
