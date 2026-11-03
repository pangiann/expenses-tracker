import { t } from '../i18n/translator.ts';
import { getElement } from '../utils/html.ts';
import { formatEuros, formatPercent } from '../utils/money.ts';
import { InlineNumberEditor } from './InlineNumberEditor.js';

/** Earned, Spent, Saved and Savings rate cards. Earned is the sum of the Income card's entries. */
export class SummaryCardsView {
  /**
   * @param {object} actions
   * @param {(amount: number) => void} actions.changeExpectedIncome
   */
  constructor(actions) {
    this.totalIncomeValue = getElement('totalIncomeValue');
    this.expectedIncomeSlot = getElement('expectedIncomeSlot');
    this.totalSpentValue = getElement('totalSpentValue');
    this.totalBudgetedValue = getElement('totalBudgetedValue');
    this.savedValue = getElement('savedValue');
    this.expectedSavingsValue = getElement('expectedSavingsValue');
    this.savingsRateValue = getElement('savingsRateValue');
    this.variableSpendingValue = getElement('variableSpendingValue');
    this.currentExpectedIncome = 0;

    this.expectedIncomeSlot.addEventListener('click', (clickEvent) => {
      const expectedIncomeElement = clickEvent.target.closest('.click-to-edit');
      if (!expectedIncomeElement) return;
      InlineNumberEditor.open(expectedIncomeElement, {
        currentValue: this.currentExpectedIncome,
        allowZero: true,
        onSave: (newAmount) => actions.changeExpectedIncome(newAmount),
      });
    });
  }

  render(monthRecord) {
    const totals = monthRecord.calculateTotals();
    this.currentExpectedIncome = monthRecord.expectedIncome;

    this.totalIncomeValue.textContent = formatEuros(monthRecord.totalIncome);
    this.expectedIncomeSlot.innerHTML = `<span class="click-to-edit" title="${t('common.clickToEdit')}">${formatEuros(monthRecord.expectedIncome)}</span>`;

    this.totalSpentValue.textContent = formatEuros(totals.totalSpent);
    this.totalSpentValue.classList.toggle('is-negative', totals.totalSpent > totals.totalBudgeted);
    this.totalBudgetedValue.textContent = formatEuros(totals.totalBudgeted);

    this.savedValue.textContent = formatEuros(totals.saved);
    this.savedValue.classList.toggle('is-positive', totals.saved >= 0);
    this.savedValue.classList.toggle('is-negative', totals.saved < 0);
    this.expectedSavingsValue.textContent = formatEuros(totals.expectedSavings);

    this.savingsRateValue.textContent = totals.savingsRate === null ? '–' : formatPercent(totals.savingsRate);
    this.variableSpendingValue.textContent = formatEuros(totals.variableSpending);
  }
}
