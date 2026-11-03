// zod/mini has the same checks as zod in a form bundlers can trim: about 7 KB in the page instead of 90 KB.
import * as z from 'zod/mini';

import { MAX_CATEGORY_NAME_LENGTH, RecurringCostList } from './categories.ts';
import type { MonthRecord } from './month-record.ts';

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
 * Changes arrive from the network, so applyMonthChange() checks them in two steps:
 *   1. MonthChangeSchema checks the shape: field types, lengths, amounts, date format.
 *   2. The rules that depend on the month: the category exists, the date is in this month,
 *      a category name isn't taken, a category being removed is empty.
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
} as const);

export class InvalidChangeError extends Error {}

const MAX_AMOUNT = 10_000_000;
const MAX_TEXT_LENGTH = 200;
const MAX_ID_LENGTH = 64;

// ----- Field shapes -----

const Id = z.string().check(z.minLength(1), z.maxLength(MAX_ID_LENGTH));
/** 0 or more, for budgets and fixed costs */
const Amount = z.number().check(z.gte(0), z.lte(MAX_AMOUNT));
/** more than 0, for expenses and income */
const PositiveAmount = z.number().check(z.gt(0), z.lte(MAX_AMOUNT));
/** Required text: at least one character that isn't a space. */
const Text = z.string().check(
  z.maxLength(MAX_TEXT_LENGTH),
  z.refine((text) => text.trim() !== '', 'Text is empty'),
);
/** Optional text; a missing description becomes ''. */
const OptionalText = z.pipe(
  z.nullish(z.string().check(z.maxLength(MAX_TEXT_LENGTH))),
  z.transform((text) => text ?? ''),
);
const IsoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const Color = z.string().check(z.regex(/^#[0-9a-f]{6}$/i));
const RecurringListName = z.enum([RecurringCostList.FIXED_COSTS, RecurringCostList.SUBSCRIPTIONS]);

const change = <Kind extends string, Shape extends z.core.$ZodLooseShape>(kind: Kind, shape: Shape) =>
  z.object({ kind: z.literal(kind), ...shape });

// ----- Every kind of change -----

export const MonthChangeSchema = z.discriminatedUnion('kind', [
  change(ChangeKind.ADD_EXPENSE, {
    expense: z.object({
      id: Id,
      categoryKey: z.string(),
      amount: PositiveAmount,
      description: OptionalText,
      date: IsoDate,
    }),
  }),
  change(ChangeKind.REMOVE_EXPENSE, { expenseId: Id }),
  change(ChangeKind.CHANGE_EXPENSE_AMOUNT, { expenseId: Id, amount: PositiveAmount }),

  change(ChangeKind.ADD_INCOME, {
    income: z.object({ id: Id, amount: PositiveAmount, description: OptionalText, date: IsoDate }),
  }),
  change(ChangeKind.REMOVE_INCOME, { incomeId: Id }),
  change(ChangeKind.CHANGE_INCOME_AMOUNT, { incomeId: Id, amount: PositiveAmount }),
  change(ChangeKind.CHANGE_EXPECTED_INCOME, { amount: Amount }),

  change(ChangeKind.ADD_CATEGORY, { category: z.object({ id: Id, name: Text, color: Color }) }),
  change(ChangeKind.RENAME_CATEGORY, { categoryId: Id, name: Text }),
  change(ChangeKind.REMOVE_CATEGORY, { categoryId: Id }),
  /** beforeCategoryId null: move to the end */
  change(ChangeKind.MOVE_CATEGORY, { categoryId: Id, beforeCategoryId: z.nullable(Id) }),
  change(ChangeKind.CHANGE_BUDGET, { categoryKey: z.string(), amount: Amount }),

  change(ChangeKind.ADD_RECURRING_COST, { listName: RecurringListName, cost: z.object({ id: Id, name: Text }) }),
  change(ChangeKind.REMOVE_RECURRING_COST, { listName: RecurringListName, costId: Id }),
  change(ChangeKind.RENAME_RECURRING_COST, { listName: RecurringListName, costId: Id, name: Text }),
  change(ChangeKind.CHANGE_RECURRING_COST_AMOUNT, { listName: RecurringListName, costId: Id, amount: Amount }),
]);

export type MonthChange = z.output<typeof MonthChangeSchema>;

/** Checks the shape of a change that arrived from outside. */
export function parseMonthChange(value: unknown): MonthChange {
  const result = MonthChangeSchema.safeParse(value);
  if (!result.success) throw new InvalidChangeError(`Invalid change: ${z.prettifyError(result.error)}`);
  return result.data;
}

/**
 * Applies one change to a month.
 * @throws {InvalidChangeError} when the change is malformed or breaks a rule of this month
 */
export function applyMonthChange(monthRecord: MonthRecord, value: unknown): void {
  const change = parseMonthChange(value);
  switch (change.kind) {
    case ChangeKind.ADD_EXPENSE: {
      const { id, categoryKey, amount, description, date } = change.expense;
      monthRecord.addExpense({
        id,
        categoryId: requireCategoryIn(monthRecord, categoryKey),
        amount,
        description,
        date: requireDateInMonth(date, monthRecord.monthKey),
      });
      return;
    }
    case ChangeKind.REMOVE_EXPENSE:
      monthRecord.removeExpense(change.expenseId);
      return;
    case ChangeKind.CHANGE_EXPENSE_AMOUNT:
      monthRecord.updateExpenseAmount(change.expenseId, change.amount);
      return;

    case ChangeKind.ADD_INCOME: {
      const { id, amount, description, date } = change.income;
      monthRecord.addIncome({ id, amount, description, date: requireDateInMonth(date, monthRecord.monthKey) });
      return;
    }
    case ChangeKind.REMOVE_INCOME:
      monthRecord.removeIncome(change.incomeId);
      return;
    case ChangeKind.CHANGE_INCOME_AMOUNT:
      monthRecord.updateIncomeAmount(change.incomeId, change.amount);
      return;
    case ChangeKind.CHANGE_EXPECTED_INCOME:
      monthRecord.setExpectedIncome(change.amount);
      return;

    case ChangeKind.ADD_CATEGORY: {
      const { id, name, color } = change.category;
      if (monthRecord.findCategory(id)) return; // already added (a resent change)
      monthRecord.addCategory({ id, name: requireCategoryName(monthRecord, name), color });
      return;
    }
    case ChangeKind.RENAME_CATEGORY:
      if (!monthRecord.findCategory(change.categoryId)) return; // removed meanwhile
      monthRecord.renameCategory(change.categoryId, requireCategoryName(monthRecord, change.name, change.categoryId));
      return;
    case ChangeKind.REMOVE_CATEGORY: {
      if (!monthRecord.findCategory(change.categoryId)) return; // already removed
      // Someone may have added an expense meanwhile; then the category stays.
      const blocker = monthRecord.categoryRemovalBlocker(change.categoryId);
      if (blocker) throw new InvalidChangeError(`Category can't be removed: ${blocker}`);
      monthRecord.removeCategory(change.categoryId);
      return;
    }
    case ChangeKind.MOVE_CATEGORY:
      monthRecord.moveCategory(change.categoryId, change.beforeCategoryId);
      return;
    case ChangeKind.CHANGE_BUDGET:
      monthRecord.setBudget(requireCategoryIn(monthRecord, change.categoryKey), change.amount);
      return;

    case ChangeKind.ADD_RECURRING_COST:
      monthRecord.addRecurringCost(change.listName, change.cost);
      return;
    case ChangeKind.REMOVE_RECURRING_COST:
      monthRecord.removeRecurringCost(change.listName, change.costId);
      return;
    case ChangeKind.RENAME_RECURRING_COST:
      monthRecord.renameRecurringCost(change.listName, change.costId, change.name);
      return;
    case ChangeKind.CHANGE_RECURRING_COST_AMOUNT:
      monthRecord.setRecurringCostAmount(change.listName, change.costId, change.amount);
      return;
  }
}

// ----- Rules that depend on the month -----

/** The category must exist in this month (each month has its own list). */
function requireCategoryIn(monthRecord: MonthRecord, categoryId: string): string {
  if (!monthRecord.findCategory(categoryId)) throw new InvalidChangeError(`Unknown category: ${categoryId}`);
  return categoryId;
}

/**
 * A category name: at most MAX_CATEGORY_NAME_LENGTH characters, and different from the
 * month's other names, ignoring capitals and surrounding spaces. The server only knows the
 * names people typed; the page also compares with the translated default names.
 */
function requireCategoryName(monthRecord: MonthRecord, name: string, renamedCategoryId?: string): string {
  const trimmedName = name.trim();
  if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) throw new InvalidChangeError('Category name too long');
  if (monthRecord.hasCategoryNamed(trimmedName, renamedCategoryId)) {
    throw new InvalidChangeError('Category name already used');
  }
  return trimmedName;
}

function requireDateInMonth(date: string, monthKey: string): string {
  if (!date.startsWith(`${monthKey}-`)) throw new InvalidChangeError(`Date ${date} is not in ${monthKey}`);
  return date;
}
