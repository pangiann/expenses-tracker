import { SPENDING_CATEGORIES, RecurringCostList } from '../config/categories.js';
import { MonthRecord } from './MonthRecord.js';

/**
 * Every edit to a month is described as a small "change" object, for example
 *   { kind: 'addExpense', expense: { id, categoryKey, amount, description, date } }
 *
 * The browser applies a change right away (so the screen updates instantly) and sends
 * the same object to the server, which applies it to the stored month. Both sides run
 * applyMonthChange(), so they always agree on the result.
 *
 * Changes name their item by id, never by position, so a change still hits the right item
 * after someone else added or removed others.
 *
 * Changes arrive from the network, so applyMonthChange() checks every field first.
 */
export const ChangeKind = Object.freeze({
  ADD_EXPENSE: 'addExpense',
  REMOVE_EXPENSE: 'removeExpense',
  CHANGE_EXPENSE_AMOUNT: 'changeExpenseAmount',
  CHANGE_BUDGET: 'changeBudget',
  CHANGE_ACTUAL_INCOME: 'changeActualIncome',
  CHANGE_EXPECTED_INCOME: 'changeExpectedIncome',
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
const CATEGORY_KEYS = new Set(SPENDING_CATEGORIES.map((category) => category.key));
const RECURRING_LIST_NAMES = new Set(Object.values(RecurringCostList));

/**
 * Applies one change to a month.
 * @param {MonthRecord} monthRecord
 * @param {object} change
 * @throws {InvalidChangeError} when the change is malformed
 */
export function applyMonthChange(monthRecord, change) {
  switch (change?.kind) {
    case ChangeKind.ADD_EXPENSE: {
      const { id, categoryKey, amount, description, date } = change.expense ?? {};
      monthRecord.addExpense({
        id: requireId(id),
        categoryKey: requireCategory(categoryKey),
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
    case ChangeKind.CHANGE_BUDGET:
      monthRecord.setBudget(requireCategory(change.categoryKey), requireAmount(change.amount));
      return;
    case ChangeKind.CHANGE_ACTUAL_INCOME:
      monthRecord.setActualIncome(requireAmount(change.amount));
      return;
    case ChangeKind.CHANGE_EXPECTED_INCOME:
      monthRecord.setExpectedIncome(requireAmount(change.amount));
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
        requireListName(change.listName), requireId(change.costId), requireText(change.name));
      return;
    case ChangeKind.CHANGE_RECURRING_COST_AMOUNT:
      monthRecord.setRecurringCostAmount(
        requireListName(change.listName), requireId(change.costId), requireAmount(change.amount));
      return;
    default:
      throw new InvalidChangeError(`Unknown change kind: ${change?.kind}`);
  }
}

// ----- Field checks -----

function requireAmount(value, { allowZero = true } = {}) {
  const isValid = typeof value === 'number' && Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0) && value <= MAX_AMOUNT;
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

function requireCategory(value) {
  if (!CATEGORY_KEYS.has(value)) throw new InvalidChangeError(`Unknown category: ${value}`);
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
