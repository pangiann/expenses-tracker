import { MAX_CATEGORY_NAME_LENGTH } from '../config/categories.js';
import { MonthRecord } from '../model/MonthRecord.js';
import { categoryName, t } from '../i18n/Translator.js';
import { escapeHtml, getElement } from '../utils/html.js';
import { formatEuros, parseAmount } from '../utils/money.js';
import { defaultExpenseDate } from '../utils/monthKeys.js';
import { InlineNumberEditor } from './InlineNumberEditor.js';
import { InlineTextEditor } from './InlineTextEditor.js';
import { renderEntryRows } from './entryRows.js';

/**
 * One card per category with its budget, its expenses and a small add form, followed by a
 * "New category" card.
 *
 * The cards are redrawn on every change, so events are handled once on the container
 * ("event delegation"). Each clickable element carries data attributes that identify it:
 *   data-entry-id     which expense an amount or ✕ belongs to
 *   data-category-id  which category a name, budget or add form belongs to
 */
export class CategoryCardsView {
  /**
   * @param {object} actions
   * @param {(expense: object) => void} actions.addExpense
   * @param {(expenseId: string) => void} actions.removeExpense
   * @param {(expenseId: string, amount: number) => void} actions.changeExpenseAmount
   * @param {(categoryKey: string, amount: number) => void} actions.changeBudget
   * @param {(name: string) => void} actions.addCategory
   * @param {(categoryId: string, name: string) => void} actions.renameCategory
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
    this.container.innerHTML = monthRecord.categories
      .map((category) => this.#renderCard(category, monthRecord))
      .join('') + this.#renderNewCategoryCard();
  }

  // ----- Event handling -----

  #handleAddFormSubmit(submitEvent) {
    submitEvent.preventDefault();
    const addForm = submitEvent.target;
    if (addForm.classList.contains('new-category-form')) {
      const name = addForm.elements.name.value.trim();
      if (!name) return;
      if (this.#isNameShown(name)) {
        addForm.querySelector('.new-category-error').textContent = t('categories.duplicateName');
        return;
      }
      this.actions.addCategory(name);
      return;
    }
    this.actions.addExpense({
      categoryKey: addForm.dataset.categoryId,
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

    const nameElement = clickEvent.target.closest('.category-name');
    if (nameElement) {
      const categoryId = nameElement.dataset.categoryId;
      InlineTextEditor.open(nameElement, {
        currentText: nameElement.textContent,
        maxLength: MAX_CATEGORY_NAME_LENGTH,
        validate: (newName) => (this.#isNameShown(newName, categoryId) ? t('categories.duplicateName') : null),
        onSave: (newName) => this.actions.renameCategory(categoryId, newName),
      });
      return;
    }

    const budgetElement = clickEvent.target.closest('.category-budget');
    if (budgetElement) {
      const categoryId = budgetElement.dataset.categoryId;
      InlineNumberEditor.open(budgetElement, {
        currentValue: this.monthRecord.budgetFor(categoryId),
        allowZero: true,
        onSave: (newAmount) => this.actions.changeBudget(categoryId, newAmount),
      });
    }
  }

  // ----- HTML -----

  /**
   * Compares with the names as shown on screen, so defaults count in the page language too.
   * @param {string} [exceptCategoryId]  the category being renamed, which may keep its own name
   */
  #isNameShown(name, exceptCategoryId) {
    const wantedName = MonthRecord.normalizeCategoryName(name);
    return this.monthRecord.categories.some((category) => category.id !== exceptCategoryId
      && MonthRecord.normalizeCategoryName(categoryName(category)) === wantedName);
  }

  #renderNewCategoryCard() {
    return `
      <form class="card new-category-card new-category-form" autocomplete="off">
        <h2>${escapeHtml(t('categories.newTitle'))}</h2>
        <div class="new-category-fields">
          <input name="name" maxlength="${MAX_CATEGORY_NAME_LENGTH}" placeholder="${escapeHtml(t('categories.namePlaceholder'))}" required>
          <button type="submit" class="primary-button">${escapeHtml(t('common.add'))}</button>
        </div>
        <p class="new-category-error" aria-live="polite"></p>
      </form>`;
  }

  #renderCard(category, monthRecord) {
    const spent = monthRecord.spentInCategory(category.id);
    const budget = monthRecord.budgetFor(category.id);
    const remaining = budget - spent;
    const isOverBudget = remaining < 0;
    const progressPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
    const progressColor = isOverBudget ? 'var(--color-negative)' : category.color;
    const remainingText = isOverBudget
      ? t('categoryCard.over', { amount: formatEuros(-remaining) })
      : t('categoryCard.left', { amount: formatEuros(remaining) });

    return `
      <div class="card category-card">
        <div class="category-card-header" style="border-top-color:${category.color}">
          <div class="category-card-title">
            <h2 class="click-to-edit category-name" data-category-id="${escapeHtml(category.id)}"
                title="${escapeHtml(t('common.clickToEdit'))}">${escapeHtml(categoryName(category))}</h2>
            <span class="category-card-spent">${formatEuros(spent)}</span>
          </div>
          <div class="category-card-budget-line">
            <span>${escapeHtml(t('categoryCard.budget'))}
              <span class="click-to-edit category-budget" data-category-id="${escapeHtml(category.id)}"
                    title="${escapeHtml(t('common.clickToEdit'))}">${formatEuros(budget)}</span>
            </span>
            <span class="${isOverBudget ? 'is-negative' : 'is-positive'}">${escapeHtml(remainingText)}</span>
          </div>
          <div class="category-card-progress-track">
            <div class="category-card-progress-fill" style="width:${progressPercentage}%;background:${progressColor}"></div>
          </div>
        </div>
        <ul class="expense-list">${renderEntryRows(monthRecord.expensesInCategory(category.id))}</ul>
        <form class="category-add-form" data-category-id="${escapeHtml(category.id)}" autocomplete="off">
          <input name="description" placeholder="${escapeHtml(t('common.descriptionPlaceholder'))}">
          <input name="amount" type="number" step="0.01" min="0" placeholder="€" required>
          <button type="submit" title="${escapeHtml(t('common.add'))}">+</button>
        </form>
      </div>`;
  }
}
