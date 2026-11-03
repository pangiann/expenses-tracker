import type { Category } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import { categoryName } from '../../i18n/translator.ts';
import { escapeHtml, getElement } from '../../utils/html.ts';
import { formatEuros } from '../../utils/money.ts';

/** One bar per category: spent compared to budget, red when over budget. */
export class BudgetBars {
  readonly #container = getElement('budgetBars');

  render(monthRecord: MonthRecord): void {
    this.#container.innerHTML = monthRecord.categories
      .map((category) => this.#renderBar(category, monthRecord))
      .join('');
  }

  #renderBar(category: Category, monthRecord: MonthRecord): string {
    const spent = monthRecord.spentInCategory(category.id);
    const budget = monthRecord.budgetFor(category.id);
    const isOverBudget = spent > budget;
    const fillPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : spent > 0 ? 100 : 0;
    const fillColor = isOverBudget ? 'var(--color-negative)' : category.color;

    return `
      <div class="budget-bar-row">
        <span>${escapeHtml(categoryName(category))}</span>
        <div class="budget-bar-track">
          <div class="budget-bar-fill" style="width:${fillPercentage}%;background:${fillColor}"></div>
        </div>
        <span class="budget-bar-amount ${isOverBudget ? 'is-negative' : ''}">${formatEuros(spent)} / ${formatEuros(budget)}</span>
      </div>`;
  }
}
