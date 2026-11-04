import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type CSSProperties, type SyntheticEvent } from 'react';

import { MAX_CATEGORY_NAME_LENGTH, type Category } from '../../../../shared/month/categories.ts';
import { MonthRecord, type CategoryRemovalBlocker } from '../../../../shared/month/month-record.ts';
import * as categoriesApi from '../../api/categories-api.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import { EditableAmount } from '../../components/editable-amount.tsx';
import { EditableText } from '../../components/editable-text.tsx';
import { EntryRows } from '../../components/entry-rows.tsx';
import { categoryName, t } from '../../i18n/translator.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate } from '../../utils/month-keys.ts';
import { AmountInput } from '../../components/amount-input.tsx';

/** Why a category's ✕ is greyed out, as string ids. */
const REMOVAL_BLOCKER_STRING_IDS: Record<CategoryRemovalBlocker, string> = {
  'has-expenses': 'categories.cannotRemoveHasExpenses',
  'last-category': 'categories.cannotRemoveLast',
};

interface CategoryCardProps {
  category: Category;
  month: MonthRecord;
}

/**
 * One category: its name, budget and expenses, and a small form to add an expense. Dragging
 * the header moves the card (category-cards.tsx). What each part calls:
 *
 *   click the name        categoriesApi.renameCategory
 *   click the budget      categoriesApi.changeBudget
 *   ✕ on the card         categoriesApi.removeCategory  (only when the category is empty)
 *   click an amount       expensesApi.changeExpenseAmount
 *   ✕ on an expense       expensesApi.removeExpense
 *   + (add form)          expensesApi.addExpense
 */
export function SortableCategoryCard({ category, month }: CategoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  // Pressing a field or a button in the header never starts a drag.
  const dragHandleListeners = Object.fromEntries(
    Object.entries(listeners ?? {}).map(([eventName, handler]) => [
      eventName,
      (event: SyntheticEvent) => {
        if ((event.target as Element).closest('input, button')) return;
        (handler as (event: SyntheticEvent) => void)(event);
      },
    ]),
  );
  return (
    <CategoryCard
      category={category}
      month={month}
      cardRef={setNodeRef}
      cardStyle={{ transform: CSS.Transform.toString(transform), transition }}
      extraClassName={isDragging ? 'is-drop-placeholder' : ''}
      dragHandleProps={{ ...attributes, ...dragHandleListeners }}
    />
  );
}

/** The copy of a card that follows the pointer while it is dragged. */
export function LiftedCategoryCard({ category, month }: CategoryCardProps) {
  return <CategoryCard category={category} month={month} extraClassName="is-lifted" />;
}

function CategoryCard({
  category,
  month,
  cardRef,
  cardStyle,
  extraClassName = '',
  dragHandleProps,
}: CategoryCardProps & {
  cardRef?: (element: HTMLElement | null) => void;
  cardStyle?: CSSProperties;
  extraClassName?: string;
  dragHandleProps?: Record<string, unknown>;
}) {
  const spent = month.spentInCategory(category.id);
  const budget = month.budgetFor(category.id);
  const remaining = budget - spent;
  const isOverBudget = remaining < 0;
  const progressPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : 0;
  const removalBlocker = month.categoryRemovalBlocker(category.id);
  const removeTitle = removalBlocker ? t(REMOVAL_BLOCKER_STRING_IDS[removalBlocker]) : t('categories.remove');

  const removeCategory = () => {
    // Touch screens can't show the hover explanation, so a tap on a greyed-out ✕ shows it.
    if (removalBlocker) return alert(t(REMOVAL_BLOCKER_STRING_IDS[removalBlocker]));
    if (confirm(t('categories.confirmRemove', { name: categoryName(category) }))) {
      categoriesApi.removeCategory(month.monthKey, category.id);
    }
  };

  return (
    <div ref={cardRef} style={cardStyle} className={`card category-card ${extraClassName}`.trim()}>
      <div className="category-card-header" style={{ borderTopColor: category.color }} {...dragHandleProps}>
        <div className="category-card-title">
          <EditableText
            as="h2"
            className="category-name"
            text={categoryName(category)}
            maxLength={MAX_CATEGORY_NAME_LENGTH}
            validate={(newName) => (isNameShown(month, newName, category.id) ? t('categories.duplicateName') : null)}
            onSave={(newName) => categoriesApi.renameCategory(month.monthKey, category.id, newName)}
          />
          <span className="category-card-spent">{formatEuros(spent)}</span>
          <button
            type="button"
            className={`category-remove-button ${removalBlocker ? 'is-blocked' : ''}`}
            aria-disabled={Boolean(removalBlocker)}
            title={removeTitle}
            aria-label={removeTitle}
            onClick={removeCategory}
          >
            ✕
          </button>
        </div>
        <div className="category-card-budget-line">
          <span>
            {t('categoryCard.budget')}{' '}
            <EditableAmount
              amount={budget}
              allowZero
              className="category-budget"
              onSave={(newAmount) => categoriesApi.changeBudget(month.monthKey, category.id, newAmount)}
            />
          </span>
          <span className={isOverBudget ? 'is-negative' : 'is-positive'}>
            {isOverBudget
              ? t('categoryCard.over', { amount: formatEuros(-remaining) })
              : t('categoryCard.left', { amount: formatEuros(remaining) })}
          </span>
        </div>
        <div className="category-card-progress-track">
          <div
            className="category-card-progress-fill"
            style={{
              width: `${progressPercentage}%`,
              background: isOverBudget ? 'var(--color-negative)' : category.color,
            }}
          ></div>
        </div>
      </div>
      <ul className="expense-list">
        <EntryRows
          entries={month.expensesInCategory(category.id)}
          onChangeAmount={(expenseId, newAmount) =>
            expensesApi.changeExpenseAmount(month.monthKey, expenseId, newAmount)
          }
          onRemove={(expenseId) => expensesApi.removeExpense(month.monthKey, expenseId)}
        />
      </ul>
      <AddExpenseForm month={month} categoryId={category.id} />
    </div>
  );
}

function AddExpenseForm({ month, categoryId }: { month: MonthRecord; categoryId: string }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <form
      className="category-add-form"
      autoComplete="off"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const isSent = expensesApi.addExpense(month.monthKey, {
          categoryId,
          amount: parseAmount(amount) ?? 0,
          description,
          date: defaultExpenseDate(month.monthKey),
        });
        if (!isSent) return;
        setDescription('');
        setAmount('');
      }}
    >
      <input
        name="description"
        placeholder={t('common.descriptionPlaceholder')}
        value={description}
        onChange={(changeEvent) => setDescription(changeEvent.target.value)}
      />
      <AmountInput
        name="amount"
        placeholder="€"
        required
        value={amount}
        onChange={(changeEvent) => setAmount(changeEvent.target.value)}
      />
      <button type="submit" title={t('common.add')}>
        +
      </button>
    </form>
  );
}

/**
 * True when another category already shows this name, ignoring capitals and spaces. It
 * compares with the names as shown, so default categories count in the page language too.
 * @param exceptCategoryId  the category being renamed, which may keep its own name
 */
export function isNameShown(month: MonthRecord, name: string, exceptCategoryId?: string): boolean {
  const wantedName = MonthRecord.normalizeCategoryName(name);
  return month.categories.some(
    (category) =>
      category.id !== exceptCategoryId && MonthRecord.normalizeCategoryName(categoryName(category)) === wantedName,
  );
}
