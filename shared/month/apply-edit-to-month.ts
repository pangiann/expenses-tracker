import type { BodyOf, EndpointName, ParamsOf } from '../api/endpoints.ts';
import type { MonthRecord } from './month-record.ts';

/** The endpoints that edit a month: every one except reading, export and import. */
export type MonthEditingEndpointName = Exclude<EndpointName, 'getMonth' | 'exportMonths' | 'importMonths'>;

/** A checked edit request: the path parameters and body of one endpoint. */
export interface CheckedMonthEditRequest<Name extends MonthEditingEndpointName> {
  params: ParamsOf<Name>;
  body: BodyOf<Name>;
}

/**
 * What each editing endpoint does to the month, in one place, used by both sides:
 *
 *   - the Worker's operation runs it on the stored month and saves the result
 *     (worker/household-durable-object/operations/);
 *   - the page runs it on its copy of the month for edits the server hasn't saved yet, so an
 *     edit shows at once, also offline (web/scripts/sync/optimistic-month.ts).
 *
 * Because both run the same function, the page's guess and the server's answer agree. Each
 * throws MonthRuleError when the edit breaks a rule of the month.
 */
export const monthEditFunctionByEndpointName: {
  [Name in MonthEditingEndpointName]: (month: MonthRecord, request: CheckedMonthEditRequest<Name>) => void;
} = {
  addExpense: (month, { body }) => month.addExpense(body),
  changeExpenseAmount: (month, { params, body }) => month.updateExpenseAmount(params.id, body.amount),
  removeExpense: (month, { params }) => month.removeExpense(params.id),

  addIncome: (month, { body }) => month.addIncome(body),
  changeIncomeAmount: (month, { params, body }) => month.updateIncomeAmount(params.id, body.amount),
  removeIncome: (month, { params }) => month.removeIncome(params.id),
  changeExpectedIncome: (month, { body }) => month.setExpectedIncome(body.amount),

  addCategory: (month, { body }) => month.addCategory(body),
  renameCategory: (month, { params, body }) => month.renameCategory(params.id, body.name),
  moveCategory: (month, { params, body }) => month.moveCategory(params.id, body.beforeCategoryId),
  changeBudget: (month, { params, body }) => month.setBudget(params.id, body.amount),
  removeCategory: (month, { params }) => month.removeCategory(params.id),

  addRecurringCost: (month, { params, body }) => month.addRecurringCost(params.list, body),
  renameRecurringCost: (month, { params, body }) => month.renameRecurringCost(params.list, params.id, body.name),
  changeRecurringCostAmount: (month, { params, body }) =>
    month.setRecurringCostAmount(params.list, params.id, body.amount),
  removeRecurringCost: (month, { params }) => month.removeRecurringCost(params.list, params.id),
};

/**
 * Whether the endpoint changes a month (addExpense, renameCategory, ...), rather than only
 * reading months (getMonth) or replacing them all (exportMonths, importMonths).
 */
export function isEndpointThatEditsAMonth(name: EndpointName): name is MonthEditingEndpointName {
  return name in monthEditFunctionByEndpointName;
}

/** Applies one endpoint's edit to the month. @throws {MonthRuleError} */
export function applyEndpointEditToMonth<Name extends MonthEditingEndpointName>(
  month: MonthRecord,
  name: Name,
  request: CheckedMonthEditRequest<Name>,
): void {
  // TypeScript can't follow the mapped type above through a generic name; this is monthEditFunctionByEndpointName[name] as declared.
  const editFunction = monthEditFunctionByEndpointName[name] as (
    month: MonthRecord,
    request: CheckedMonthEditRequest<Name>,
  ) => void;
  editFunction(month, request);
}
