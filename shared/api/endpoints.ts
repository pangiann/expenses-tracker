/**
 * Every HTTP endpoint of the app: its method, its path, and the shape of its path
 * parameters and request body. This table is the contract between the page and the Worker:
 *
 *   - the page's API functions (web/scripts/api/) build requests from it, and
 *   - the Worker's router (worker/household/router.ts) matches requests against it, checks
 *     them, and calls the handler with the same name (worker/household/handlers/).
 *
 * Path parameters are written ":name". Every endpoint that edits a month answers with the
 * whole month after the edit (MonthResponse), which the page then shows. Edits are safe to
 * send twice: new items carry an id made by the page, and adding an id that already exists,
 * or removing something already gone, changes nothing.
 */
// zod/mini has the same checks as zod in a form bundlers can trim (see fields.ts).
import * as z from 'zod/mini';

import type { MonthData, MonthRule, StoredMonthData } from '../month/month-record.ts';
import {
  Amount,
  Color,
  Id,
  IsoDate,
  MonthKey,
  OptionalText,
  PositiveAmount,
  RecurringListName,
  Text,
} from './fields.ts';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Endpoint<Params extends z.ZodMiniType = z.ZodMiniType, Body extends z.ZodMiniType = z.ZodMiniType> {
  method: HttpMethod;
  /** for example "/api/months/:month/expenses" */
  path: string;
  params: Params;
  body: Body;
}

const NoBody = z.undefined();

function endpoint<ParamShape extends z.core.$ZodLooseShape, Body extends z.ZodMiniType = typeof NoBody>(
  method: HttpMethod,
  path: string,
  params: ParamShape,
  body?: Body,
): Endpoint<z.ZodMiniObject<ParamShape>, Body> {
  return { method, path, params: z.object(params), body: (body ?? NoBody) as Body };
}

const InMonth = { month: MonthKey };
const ItemInMonth = { month: MonthKey, id: Id };
const RecurringCostInMonth = { month: MonthKey, list: RecurringListName, id: Id };

export const endpoints = {
  // ----- Months -----
  /** The month, created from the closest saved month if it doesn't exist yet. */
  getMonth: endpoint('GET', '/api/months/:month', InMonth),
  /** Every saved month, for a backup file. */
  exportMonths: endpoint('GET', '/api/export', {}),
  /** Replaces the months in a backup file. Each month is checked by the handler. */
  importMonths: endpoint('POST', '/api/import', {}, z.object({ months: z.array(z.unknown()) })),

  // ----- Expenses -----
  addExpense: endpoint(
    'POST',
    '/api/months/:month/expenses',
    InMonth,
    z.object({ id: Id, categoryId: Id, amount: PositiveAmount, description: OptionalText, date: IsoDate }),
  ),
  changeExpenseAmount: endpoint(
    'PUT',
    '/api/months/:month/expenses/:id/amount',
    ItemInMonth,
    z.object({ amount: PositiveAmount }),
  ),
  removeExpense: endpoint('DELETE', '/api/months/:month/expenses/:id', ItemInMonth),

  // ----- Income -----
  addIncome: endpoint(
    'POST',
    '/api/months/:month/income',
    InMonth,
    z.object({ id: Id, amount: PositiveAmount, description: OptionalText, date: IsoDate }),
  ),
  changeIncomeAmount: endpoint(
    'PUT',
    '/api/months/:month/income/:id/amount',
    ItemInMonth,
    z.object({ amount: PositiveAmount }),
  ),
  removeIncome: endpoint('DELETE', '/api/months/:month/income/:id', ItemInMonth),
  changeExpectedIncome: endpoint('PUT', '/api/months/:month/expected-income', InMonth, z.object({ amount: Amount })),

  // ----- Categories and budgets -----
  addCategory: endpoint(
    'POST',
    '/api/months/:month/categories',
    InMonth,
    z.object({ id: Id, name: Text, color: Color }),
  ),
  renameCategory: endpoint('PUT', '/api/months/:month/categories/:id/name', ItemInMonth, z.object({ name: Text })),
  /** Moves the category just before another one, or to the end when beforeCategoryId is null. */
  moveCategory: endpoint(
    'PUT',
    '/api/months/:month/categories/:id/position',
    ItemInMonth,
    z.object({ beforeCategoryId: z.nullable(Id) }),
  ),
  changeBudget: endpoint('PUT', '/api/months/:month/categories/:id/budget', ItemInMonth, z.object({ amount: Amount })),
  removeCategory: endpoint('DELETE', '/api/months/:month/categories/:id', ItemInMonth),

  // ----- Fixed costs and subscriptions ("recurring/:list" is "recurring/fixed" or "recurring/subscriptions") -----
  addRecurringCost: endpoint(
    'POST',
    '/api/months/:month/recurring/:list',
    { month: MonthKey, list: RecurringListName },
    z.object({ id: Id, name: Text }),
  ),
  renameRecurringCost: endpoint(
    'PUT',
    '/api/months/:month/recurring/:list/:id/name',
    RecurringCostInMonth,
    z.object({ name: Text }),
  ),
  changeRecurringCostAmount: endpoint(
    'PUT',
    '/api/months/:month/recurring/:list/:id/amount',
    RecurringCostInMonth,
    z.object({ amount: Amount }),
  ),
  removeRecurringCost: endpoint('DELETE', '/api/months/:month/recurring/:list/:id', RecurringCostInMonth),
} as const;

export type EndpointName = keyof typeof endpoints;

/** The path parameters of an endpoint, after checking. */
export type ParamsOf<Name extends EndpointName> = z.output<(typeof endpoints)[Name]['params']>;
/** The request body of an endpoint, after checking. */
export type BodyOf<Name extends EndpointName> = z.output<(typeof endpoints)[Name]['body']>;
/** The request body an endpoint accepts, before checking (for example a description may be missing). */
export type BodyInputOf<Name extends EndpointName> = z.input<(typeof endpoints)[Name]['body']>;

// ----- Responses -----

/** The answer to getMonth and to every edit: the month as saved, and which months exist. */
export interface MonthResponse {
  month: MonthData;
  /** every saved month, oldest first */
  monthKeys: string[];
  /**
   * Goes up by one with every save in the household. Answers and live updates can arrive
   * out of order; the page shows a month only if its revision is newer than what it shows.
   */
  revision: number;
}

export interface ExportResponse {
  months: StoredMonthData[];
}

export interface ImportResponse {
  count: number;
}

/** What each endpoint answers when it succeeds. */
export type ResponseOf<Name extends EndpointName> = Name extends 'exportMonths'
  ? ExportResponse
  : Name extends 'importMonths'
    ? ImportResponse
    : MonthResponse;

/**
 * The answer when a request fails, with HTTP status:
 *   400  the request doesn't match the endpoint (a field is missing or out of range)
 *   404  no endpoint has this method and path
 *   409  the edit breaks a rule of the month; `rule` says which
 *   500  something went wrong in the Worker
 */
export interface ErrorResponse {
  error: string;
  rule?: MonthRule;
}

/**
 * The path for an endpoint with its parameters filled in, for example
 * pathFor('/api/months/:month/expenses', { month: '2026-11' }) -> '/api/months/2026-11/expenses'.
 */
export function pathFor(path: string, params: Record<string, string>): string {
  return path.replace(/:([a-z]+)/gi, (_placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter: ${name}`);
    return encodeURIComponent(value);
  });
}

/**
 * The parameters in a request path, if it matches the endpoint path:
 * matchPath('/api/months/:month', '/api/months/2026-11') -> { month: '2026-11' }; otherwise null.
 */
export function matchPath(path: string, requestPath: string): Record<string, string> | null {
  const pathSegments = path.split('/');
  const requestSegments = requestPath.split('/');
  if (pathSegments.length !== requestSegments.length) return null;
  const params: Record<string, string> = {};
  for (const [position, segment] of pathSegments.entries()) {
    const requestSegment = requestSegments[position] ?? '';
    if (segment.startsWith(':')) {
      if (requestSegment === '') return null;
      try {
        params[segment.slice(1)] = decodeURIComponent(requestSegment);
      } catch {
        return null; // malformed %-encoding
      }
    } else if (segment !== requestSegment) {
      return null;
    }
  }
  return params;
}
