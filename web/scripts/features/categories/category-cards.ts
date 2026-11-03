import { MAX_CATEGORY_NAME_LENGTH, type Category } from '../../../../shared/month/categories.ts';
import { MonthRecord, type CategoryRemovalBlocker } from '../../../../shared/month/month-record.ts';
import * as categoriesApi from '../../api/categories-api.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import { renderEntryRows } from '../../components/entry-rows.ts';
import { InlineNumberEditor } from '../../components/inline-number-editor.ts';
import { InlineTextEditor } from '../../components/inline-text-editor.ts';
import { categoryName, t } from '../../i18n/translator.ts';
import { escapeHtml, getElement } from '../../utils/html.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate } from '../../utils/month-keys.ts';
import { CategoryDrag } from './category-drag.ts';

/** Why a category's ✕ is greyed out, as string ids. */
const REMOVAL_BLOCKER_STRING_IDS: Record<CategoryRemovalBlocker, string> = {
  'has-expenses': 'categories.cannotRemoveHasExpenses',
  'last-category': 'categories.cannotRemoveLast',
};

/**
 * One card per category with its budget, its expenses and a small add form, followed by a
 * "New category" card. What each part of a card does:
 *
 *   add form (+)          expensesApi.addExpense        POST   /api/months/:month/expenses
 *   click an amount       expensesApi.changeExpenseAmount
 *   ✕ on an expense       expensesApi.removeExpense
 *   click the name        categoriesApi.renameCategory
 *   click the budget      categoriesApi.changeBudget
 *   ✕ on the card         categoriesApi.removeCategory  (only when empty)
 *   drag the header       categoriesApi.moveCategory    (see category-drag.ts)
 *   "New category" card   categoriesApi.addCategory
 *
 * The cards are redrawn on every change, so events are handled once on the container
 * ("event delegation"). Each clickable element carries data attributes that identify it:
 *   data-entry-id     which expense an amount or ✕ belongs to
 *   data-category-id  which category a name, budget or add form belongs to
 */
export class CategoryCards {
  readonly #container = getElement('categoryCards');
  readonly #drag: CategoryDrag;
  #month: MonthRecord | null = null;
  /** A month that arrived during a drag; drawn when the drag ends, so the cards don't jump. */
  #monthWaitingForDragEnd: MonthRecord | null = null;

  constructor() {
    this.#drag = new CategoryDrag(this.#container, {
      onMove: (categoryId, beforeCategoryId) => {
        if (this.#month) categoriesApi.moveCategory(this.#month.monthKey, categoryId, beforeCategoryId);
      },
      onDragEnd: () => this.#drawWaitingMonth(),
    });
    this.#container.addEventListener('submit', (submitEvent) => this.#handleSubmit(submitEvent));
    this.#container.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(month: MonthRecord): void {
    if (this.#drag.isDragging) {
      this.#monthWaitingForDragEnd = month;
      return;
    }
    this.#monthWaitingForDragEnd = null;
    this.#month = month;
    this.#container.innerHTML =
      month.categories.map((category) => this.#renderCard(category, month)).join('') + this.#renderNewCategoryCard();
  }

  #drawWaitingMonth(): void {
    if (this.#monthWaitingForDragEnd) this.render(this.#monthWaitingForDragEnd);
  }

  // ----- Event handling -----

  #handleSubmit(submitEvent: SubmitEvent): void {
    submitEvent.preventDefault();
    const form = submitEvent.target;
    const month = this.#month;
    if (!(form instanceof HTMLFormElement) || !month) return;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;

    if (form.classList.contains('new-category-form')) {
      const name = field('name').value.trim();
      if (!name) return;
      if (this.#isNameShown(name)) {
        const errorElement = form.querySelector('.new-category-error');
        if (errorElement) errorElement.textContent = t('categories.duplicateName');
        return;
      }
      categoriesApi.addCategory(month.monthKey, { name, color: month.pickCategoryColor() });
      return;
    }

    expensesApi.addExpense(month.monthKey, {
      categoryId: form.dataset.categoryId ?? '',
      amount: parseAmount(field('amount').value) ?? 0,
      description: field('description').value,
      date: defaultExpenseDate(month.monthKey),
    });
  }

  #handleClick(clickEvent: MouseEvent): void {
    const target = clickEvent.target as Element;
    const month = this.#month;
    if (!month) return;
    const clicked = (selector: string) => target.closest<HTMLElement>(selector);

    const removeCategoryButton = clicked('.category-remove-button');
    if (removeCategoryButton) return this.#removeCategory(month, removeCategoryButton.dataset.categoryId ?? '');

    const deleteButton = clicked('.delete-button');
    if (deleteButton) {
      expensesApi.removeExpense(month.monthKey, deleteButton.dataset.entryId ?? '');
      return;
    }

    const amountElement = clicked('.entry-amount');
    const expense = amountElement && month.findExpense(amountElement.dataset.entryId ?? '');
    if (amountElement && expense) {
      InlineNumberEditor.open(amountElement, {
        currentValue: expense.amount,
        onSave: (newAmount) => expensesApi.changeExpenseAmount(month.monthKey, expense.id, newAmount),
      });
      return;
    }

    const nameElement = clicked('.category-name');
    if (nameElement) {
      const categoryId = nameElement.dataset.categoryId ?? '';
      InlineTextEditor.open(nameElement, {
        currentText: nameElement.textContent ?? '',
        maxLength: MAX_CATEGORY_NAME_LENGTH,
        validate: (newName) => (this.#isNameShown(newName, categoryId) ? t('categories.duplicateName') : null),
        onSave: (newName) => categoriesApi.renameCategory(month.monthKey, categoryId, newName),
      });
      return;
    }

    const budgetElement = clicked('.category-budget');
    if (budgetElement) {
      const categoryId = budgetElement.dataset.categoryId ?? '';
      InlineNumberEditor.open(budgetElement, {
        currentValue: month.budgetFor(categoryId),
        allowZero: true,
        onSave: (newAmount) => categoriesApi.changeBudget(month.monthKey, categoryId, newAmount),
      });
    }
  }

  /** Removes an empty category after a confirmation; explains why when it can't be removed. */
  #removeCategory(month: MonthRecord, categoryId: string): void {
    const category = month.findCategory(categoryId);
    if (!category) return;
    const blocker = month.categoryRemovalBlocker(categoryId);
    // Touch screens can't show the hover explanation, so a tap on a greyed-out ✕ shows it.
    if (blocker) return alert(t(REMOVAL_BLOCKER_STRING_IDS[blocker]));
    if (confirm(t('categories.confirmRemove', { name: categoryName(category) }))) {
      categoriesApi.removeCategory(month.monthKey, categoryId);
    }
  }

  /**
   * Compares with the names as shown on screen, so defaults count in the page language too.
   * @param exceptCategoryId  the category being renamed, which may keep its own name
   */
  #isNameShown(name: string, exceptCategoryId?: string): boolean {
    const wantedName = MonthRecord.normalizeCategoryName(name);
    return (this.#month?.categories ?? []).some(
      (category) =>
        category.id !== exceptCategoryId && MonthRecord.normalizeCategoryName(categoryName(category)) === wantedName,
    );
  }

  // ----- HTML -----

  #renderNewCategoryCard(): string {
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

  #renderCard(category: Category, month: MonthRecord): string {
    const spent = month.spentInCategory(category.id);
    const budget = month.budgetFor(category.id);
    const remaining = budget - spent;
    const isOverBudget = remaining < 0;
    const progressPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
    const progressColor = isOverBudget ? 'var(--color-negative)' : category.color;
    const removalBlocker = month.categoryRemovalBlocker(category.id);
    const removeTitle = removalBlocker ? t(REMOVAL_BLOCKER_STRING_IDS[removalBlocker]) : t('categories.remove');
    const remainingText = isOverBudget
      ? t('categoryCard.over', { amount: formatEuros(-remaining) })
      : t('categoryCard.left', { amount: formatEuros(remaining) });

    return `
      <div class="card category-card" data-category-id="${escapeHtml(category.id)}">
        <div class="category-card-header" style="border-top-color:${category.color}">
          <div class="category-card-title">
            <h2 class="click-to-edit category-name" data-category-id="${escapeHtml(category.id)}"
                title="${escapeHtml(t('common.clickToEdit'))}">${escapeHtml(categoryName(category))}</h2>
            <span class="category-card-spent">${formatEuros(spent)}</span>
            <button type="button" class="category-remove-button ${removalBlocker ? 'is-blocked' : ''}"
                    data-category-id="${escapeHtml(category.id)}" aria-disabled="${Boolean(removalBlocker)}"
                    title="${escapeHtml(removeTitle)}" aria-label="${escapeHtml(removeTitle)}">✕</button>
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
        <ul class="expense-list">${renderEntryRows(month.expensesInCategory(category.id))}</ul>
        <form class="category-add-form" data-category-id="${escapeHtml(category.id)}" autocomplete="off">
          <input name="description" placeholder="${escapeHtml(t('common.descriptionPlaceholder'))}">
          <input name="amount" type="number" step="0.01" min="0" placeholder="€" required>
          <button type="submit" title="${escapeHtml(t('common.add'))}">+</button>
        </form>
      </div>`;
  }
}
