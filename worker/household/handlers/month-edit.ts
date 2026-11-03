import type { ResponseOf } from '../../../shared/api/endpoints.ts';
import { applyMonthEdit, type MonthEditName } from '../../../shared/api/month-edits.ts';
import { editMonth } from '../household.ts';
import type { Handler } from './handler.ts';

/**
 * The handler for an endpoint that edits a month, for example addExpense:
 * load the month, apply the endpoint's edit from shared/api/month-edits.ts, save, and send
 * the month to every device showing it (see editMonth). It answers with that month.
 */
export function monthEditHandler<Name extends MonthEditName>(name: Name): Handler<Name> {
  return (request, household) =>
    // Every edit answers with the month (MonthResponse); TypeScript can't see that through the generic name.
    editMonth(household, request.params.month, (month) => applyMonthEdit(month, name, request)) as Promise<
      ResponseOf<Name>
    >;
}
