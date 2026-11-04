import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/expected-income: sets the expected income.
 * The edit itself is monthEditPerEndpoint.changeExpectedIncome, which the page also runs to show the edit at once.
 */
export const changeExpectedIncomeOperation: Operation<'changeExpectedIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.changeExpectedIncome(month, request),
  );
