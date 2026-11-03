import { MAX_CATEGORY_NAME_LENGTH, RecurringCostList } from './categories.ts';

/**
 * Every edit to a month is described as a small "change" object, for example
 *   { kind: 'addExpense', expense: { id, categoryKey, amount, description, date } }
 *
 * The browser applies a change right away (so the screen updates instantly) and sends
 * the same object to the server, which applies it to the stored month. Both sides run
 * applyMonthChange(), so they always agree on the result.
 *
 * Every change names its item by id, never by position, so a change still hits the right
 * item after someone else added or removed others. Applying a change twice is harmless.
 *
 * Changes arrive from the network, so applyMonthChange() checks every field first.
 * (Changes name a category in the field `categoryKey`; it holds the category's id.)
 */
export const ChangeKind = Object.freeze({
  ADD_EXPENSE: 'addExpense',
  REMOVE_EXPENSE: 'removeExpense',
  CHANGE_EXPENSE_AMOUNT: 'changeExpenseAmount',
  ADD_INCOME: 'addIncome',
  REMOVE_INCOME: 'removeIncome',
  CHANGE_INCOME_AMOUNT: 'changeIncomeAmount',
  CHANGE_EXPECTED_INCOME: 'changeExpectedIncome',
  ADD_CATEGORY: 'addCategory',
  RENAME_CATEGORY: 'renameCategory',
  REMOVE_CATEGORY: 'removeCategory',
  MOVE_CATEGORY: 'moveCategory',
  CHANGE_BUDGET: 'changeBudget',
  ADD_RECURRING_COST: 'addRecurringCost',
  REMOVE_RECURRING_COST: 'removeRecurringCost',
  RENAME_RECURRING_COST: 'renameRecurringCost',
  CHANGE_RECURRING_COST_AMOUNT: 'changeRecurringCostAmount',
});

export class InvalidChangeError extends Error {}

const MAX_AMOUNT = 10_000_000;
const MAX_TEXT_LENGTH = 200;
const MAX_ID_LENGTH = 64;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const RECURRING_LIST_NAMES = new Set(Object.values(RecurringCostList));

/**
 * Applies one change to a month.
 * @param {import('./month-record.ts').MonthRecord} monthRecord
 * @param {object} change
 * @throws {InvalidChangeError} when the change is malformed
 */
export function applyMonthChange(monthRecord, change) {
  switch (change?.kind) {
    case ChangeKind.ADD_EXPENSE: {
      const { id, categoryKey, amount, description, date } = change.expense ?? {};
      monthRecord.addExpense({
        id: requireId(id),
        categoryId: requireCategoryIn(monthRecord, categoryKey),
        amount: requireAmount(amount, { allowZero: false }),
        description: requireText(description ?? '', { allowEmpty: true }),
        date: requireDateInMonth(date, monthRecord.monthKey),
      });
      return;
    }
    case ChangeKind.REMOVE_EXPENSE:
      monthRecord.removeExpense(requireId(change.expenseId));
      return;
    case ChangeKind.CHANGE_EXPENSE_AMOUNT:
      monthRecord.updateExpenseAmount(requireId(change.expenseId), requireAmount(change.amount, { allowZero: false }));
      return;

    case ChangeKind.ADD_INCOME: {
      const { id, amount, description, date } = change.income ?? {};
      monthRecord.addIncome({
        id: requireId(id),
        amount: requireAmount(amount, { allowZero: false }),
        description: requireText(description ?? '', { allowEmpty: true }),
        date: requireDateInMonth(date, monthRecord.monthKey),
      });
      return;
    }
    case ChangeKind.REMOVE_INCOME:
      monthRecord.removeIncome(requireId(change.incomeId));
      return;
    case ChangeKind.CHANGE_INCOME_AMOUNT:
      monthRecord.updateIncomeAmount(requireId(change.incomeId), requireAmount(change.amount, { allowZero: false }));
      return;
    case ChangeKind.CHANGE_EXPECTED_INCOME:
      monthRecord.setExpectedIncome(requireAmount(change.amount));
      return;

    case ChangeKind.ADD_CATEGORY: {
      const { id, name, color } = change.category ?? {};
      if (monthRecord.findCategory(requireId(id))) return; // already added (a resent change)
      monthRecord.addCategory({ id, name: requireCategoryName(monthRecord, name), color: requireColor(color) });
      return;
    }
    case ChangeKind.RENAME_CATEGORY: {
      const categoryId = requireId(change.categoryId);
      if (!monthRecord.findCategory(categoryId)) return; // removed meanwhile
      monthRecord.renameCategory(categoryId, requireCategoryName(monthRecord, change.name, categoryId));
      return;
    }
    case ChangeKind.REMOVE_CATEGORY: {
      const categoryId = requireId(change.categoryId);
      if (!monthRecord.findCategory(categoryId)) return; // already removed
      // Someone may have added an expense meanwhile; then the category stays.
      const blocker = monthRecord.categoryRemovalBlocker(categoryId);
      if (blocker) throw new InvalidChangeError(`Category can't be removed: ${blocker}`);
      monthRecord.removeCategory(categoryId);
      return;
    }
    case ChangeKind.MOVE_CATEGORY: {
      const beforeCategoryId = change.beforeCategoryId === null ? null : requireId(change.beforeCategoryId);
      monthRecord.moveCategory(requireId(change.categoryId), beforeCategoryId);
      return;
    }
    case ChangeKind.CHANGE_BUDGET:
      monthRecord.setBudget(requireCategoryIn(monthRecord, change.categoryKey), requireAmount(change.amount));
      return;

    case ChangeKind.ADD_RECURRING_COST: {
      const { id, name } = change.cost ?? {};
      monthRecord.addRecurringCost(requireListName(change.listName), { id: requireId(id), name: requireText(name) });
      return;
    }
    case ChangeKind.REMOVE_RECURRING_COST:
      monthRecord.removeRecurringCost(requireListName(change.listName), requireId(change.costId));
      return;
    case ChangeKind.RENAME_RECURRING_COST:
      monthRecord.renameRecurringCost(
        requireListName(change.listName),
        requireId(change.costId),
        requireText(change.name),
      );
      return;
    case ChangeKind.CHANGE_RECURRING_COST_AMOUNT:
      monthRecord.setRecurringCostAmount(
        requireListName(change.listName),
        requireId(change.costId),
        requireAmount(change.amount),
      );
      return;

    default:
      throw new InvalidChangeError(`Unknown change kind: ${change?.kind}`);
  }
}

// ----- Field checks -----

function requireAmount(value, { allowZero = true } = {}) {
  const isValid =
    typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && value <= MAX_AMOUNT;
  if (!isValid) throw new InvalidChangeError(`Invalid amount: ${value}`);
  return value;
}

function requireText(value, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH || (!allowEmpty && value.trim() === '')) {
    throw new InvalidChangeError('Invalid text');
  }
  return value;
}

function requireId(value) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_ID_LENGTH) {
    throw new InvalidChangeError('Invalid id');
  }
  return value;
}

/** The category must exist in this month (each month has its own list). */
function requireCategoryIn(monthRecord, value) {
  if (typeof value !== 'string' || !monthRecord.findCategory(value)) {
    throw new InvalidChangeError(`Unknown category: ${value}`);
  }
  return value;
}

/**
 * A category name: not empty, at most MAX_CATEGORY_NAME_LENGTH characters, and different
 * from the month's other names, ignoring capitals and surrounding spaces. The server only
 * knows the names people typed; the page also compares with the translated default names.
 */
function requireCategoryName(monthRecord, value, renamedCategoryId) {
  const trimmedName = requireText(value).trim();
  if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) throw new InvalidChangeError('Category name too long');
  if (monthRecord.hasCategoryNamed(trimmedName, renamedCategoryId))
    throw new InvalidChangeError('Category name already used');
  return trimmedName;
}

function requireColor(value) {
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) throw new InvalidChangeError(`Invalid colour: ${value}`);
  return value;
}

function requireListName(value) {
  if (!RECURRING_LIST_NAMES.has(value)) throw new InvalidChangeError(`Unknown list: ${value}`);
  return value;
}

function requireDateInMonth(value, monthKey) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || !value.startsWith(`${monthKey}-`)) {
    throw new InvalidChangeError(`Date ${value} is not in ${monthKey}`);
  }
  return value;
}
