import { SPENDING_CATEGORIES } from '../config/categories.js';
import { escapeHtml, getElement } from '../utils/html.js';
import { formatEuros, parseAmount } from '../utils/money.js';
import { defaultExpenseDate } from '../utils/monthKeys.js';
import { InlineNumberEditor } from './InlineNumberEditor.js';
import { renderEntryRows } from './entryRows.js';

/**
 * One card per category with its budget, its expenses and a small add form.
 *
 * The cards are redrawn on every change, so events are handled once on the container
 * ("event delegation"). Each clickable element carries data attributes that identify it:
 *   data-entry-id     which expense an amount or ✕ belongs to
 *   data-category-key which category a budget or add form belongs to
 */
export class CategoryCardsView {
  /**
   * @param {object} actions
   * @param {(expense: object) => void} actions.addExpense
   * @param {(expenseId: string) => void} actions.removeExpense
   * @param {(expenseId: string, amount: number) => void} actions.changeExpenseAmount
   * @param {(categoryKey: string, amount: number) => void} actions.changeBudget
   */
  constructor(actions) {
    this.actions = actions;
    this.container = getElement('categoryCards');
    this.monthRecord = null;

    this.container.addEventListener('submit', (submitEvent) => this.#handleAddFormSubmit(submitEvent));
    this.container.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(monthRecord) {
    this.monthRecord = monthRecord;
    this.container.innerHTML = SPENDING_CATEGORIES
      .map((category) => this.#renderCard(category, monthRecord))
      .join('');
  }

  // ----- Event handling -----

  #handleAddFormSubmit(submitEvent) {
    submitEvent.preventDefault();
    const addForm = submitEvent.target;
    this.actions.addExpense({
      categoryKey: addForm.dataset.categoryKey,
      amount: parseAmount(addForm.elements.amount.value),
      description: addForm.elements.description.value,
      date: defaultExpenseDate(this.monthRecord.monthKey),
    });
  }

  #handleClick(clickEvent) {
    const deleteButton = clickEvent.target.closest('.delete-button');
    if (deleteButton) {
      this.actions.removeExpense(deleteButton.dataset.entryId);
      return;
    }

    const amountElement = clickEvent.target.closest('.entry-amount');
    if (amountElement) {
      const expenseId = amountElement.dataset.entryId;
      InlineNumberEditor.open(amountElement, {
        currentValue: this.monthRecord.findExpense(expenseId).amount,
        onSave: (newAmount) => this.actions.changeExpenseAmount(expenseId, newAmount),
      });
      return;
    }

    const budgetElement = clickEvent.target.closest('.category-budget');
    if (budgetElement) {
      const categoryKey = budgetElement.dataset.categoryKey;
      InlineNumberEditor.open(budgetElement, {
        currentValue: this.monthRecord.budgetFor(categoryKey),
        allowZero: true,
        onSave: (newAmount) => this.actions.changeBudget(categoryKey, newAmount),
      });
    }
  }

  // ----- HTML -----

  #renderCard(category, monthRecord) {
    const spent = monthRecord.spentInCategory(category.key);
    const budget = monthRecord.budgetFor(category.key);
    const remaining = budget - spent;
    const isOverBudget = remaining < 0;
    const progressPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
    const progressColor = isOverBudget ? 'var(--color-negative)' : category.color;
    const remainingText = isOverBudget ? `${formatEuros(-remaining)} over` : `${formatEuros(remaining)} left`;

    return `
      <div class="card category-card">
        <div class="category-card-header" style="border-top-color:${category.color}">
          <div class="category-card-title">
            <h2>${category.displayName}</h2>
            <span class="category-card-spent">${formatEuros(spent)}</span>
          </div>
          <div class="category-card-budget-line">
            <span>Budget
              <span class="click-to-edit category-budget" data-category-key="${category.key}"
                    title="Click to edit">${formatEuros(budget)}</span>
            </span>
            <span class="${isOverBudget ? 'is-negative' : 'is-positive'}">${escapeHtml(remainingText)}</span>
          </div>
          <div class="category-card-progress-track">
            <div class="category-card-progress-fill" style="width:${progressPercentage}%;background:${progressColor}"></div>
          </div>
        </div>
        <ul class="expense-list">${renderEntryRows(monthRecord.expensesInCategory(category.key))}</ul>
        <form class="category-add-form" data-category-key="${category.key}" autocomplete="off">
          <input name="description" placeholder="Description">
          <input name="amount" type="number" step="0.01" min="0" placeholder="€" required>
          <button type="submit" title="Add">+</button>
        </form>
      </div>`;
  }
}
