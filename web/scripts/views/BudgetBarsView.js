import { SPENDING_CATEGORIES } from '../config/categories.js';
import { getElement } from '../utils/html.js';
import { formatEuros } from '../utils/money.js';

/** One bar per category: spent compared to budget, red when over budget. */
export class BudgetBarsView {
  constructor() {
    this.container = getElement('budgetBars');
  }

  render(monthRecord) {
    this.container.innerHTML = SPENDING_CATEGORIES
      .map((category) => this.#renderBar(category, monthRecord))
      .join('');
  }

  #renderBar(category, monthRecord) {
    const spent = monthRecord.spentInCategory(category.key);
    const budget = monthRecord.budgetFor(category.key);
    const isOverBudget = spent > budget;
    const fillPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : (spent > 0 ? 100 : 0);
    const fillColor = isOverBudget ? 'var(--color-negative)' : category.color;

    return `
      <div class="budget-bar-row">
        <span>${category.displayName}</span>
        <div class="budget-bar-track">
          <div class="budget-bar-fill" style="width:${fillPercentage}%;background:${fillColor}"></div>
        </div>
        <span class="budget-bar-amount ${isOverBudget ? 'is-negative' : ''}">${formatEuros(spent)} / ${formatEuros(budget)}</span>
      </div>`;
  }
}
