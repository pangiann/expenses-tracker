import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as incomeApi from '../../api/income-api.ts';
import { InlineNumberEditor } from '../../components/inline-number-editor.ts';
import { t } from '../../i18n/translator.ts';
import { getElement } from '../../utils/html.ts';
import { formatEuros, formatPercent } from '../../utils/money.ts';

/**
 * Earned, Spent, Saved and Savings rate cards. Earned is the sum of the Income card's
 * entries. Clicking the expected income edits it (PUT /api/months/:month/expected-income).
 */
export class SummaryCards {
  readonly #totalIncomeValue = getElement('totalIncomeValue');
  readonly #expectedIncomeSlot = getElement('expectedIncomeSlot');
  readonly #totalSpentValue = getElement('totalSpentValue');
  readonly #totalBudgetedValue = getElement('totalBudgetedValue');
  readonly #savedValue = getElement('savedValue');
  readonly #expectedSavingsValue = getElement('expectedSavingsValue');
  readonly #savingsRateValue = getElement('savingsRateValue');
  readonly #variableSpendingValue = getElement('variableSpendingValue');
  #month: MonthRecord | null = null;

  constructor() {
    this.#expectedIncomeSlot.addEventListener('click', (clickEvent) => {
      const expectedIncomeElement = (clickEvent.target as Element).closest<HTMLElement>('.click-to-edit');
      const month = this.#month;
      if (!expectedIncomeElement || !month) return;
      InlineNumberEditor.open(expectedIncomeElement, {
        currentValue: month.expectedIncome,
        allowZero: true,
        onSave: (newAmount) => incomeApi.changeExpectedIncome(month.monthKey, newAmount),
      });
    });
  }

  render(month: MonthRecord): void {
    this.#month = month;
    const totals = month.calculateTotals();

    this.#totalIncomeValue.textContent = formatEuros(month.totalIncome);
    this.#expectedIncomeSlot.innerHTML = `<span class="click-to-edit" title="${t('common.clickToEdit')}">${formatEuros(month.expectedIncome)}</span>`;

    this.#totalSpentValue.textContent = formatEuros(totals.totalSpent);
    this.#totalSpentValue.classList.toggle('is-negative', totals.totalSpent > totals.totalBudgeted);
    this.#totalBudgetedValue.textContent = formatEuros(totals.totalBudgeted);

    this.#savedValue.textContent = formatEuros(totals.saved);
    this.#savedValue.classList.toggle('is-positive', totals.saved >= 0);
    this.#savedValue.classList.toggle('is-negative', totals.saved < 0);
    this.#expectedSavingsValue.textContent = formatEuros(totals.expectedSavings);

    this.#savingsRateValue.textContent = totals.savingsRate === null ? '–' : formatPercent(totals.savingsRate);
    this.#variableSpendingValue.textContent = formatEuros(totals.variableSpending);
  }
}
