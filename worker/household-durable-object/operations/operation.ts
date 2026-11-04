import type { BodyOf, EndpointName, ParamsOf, ResponseOf } from '../../../shared/api/endpoints.ts';
import type { OperationContext } from '../operation-context.ts';

/** The checked path parameters and body of one endpoint's request. */
export interface OperationRequest<Name extends EndpointName> {
  params: ParamsOf<Name>;
  body: BodyOf<Name>;
}

/**
 * The function that answers one endpoint of shared/api/endpoints.ts, named after it
 * (addExpense -> addExpenseOperation). They are grouped by what they do:
 *   add-operations.ts      add an expense, income entry, category, fixed cost or subscription
 *   change-operations.ts   change an amount, a name, a budget, the order of categories
 *   remove-operations.ts   remove any of those
 *   read-operations.ts     get a month
 *   backup-operations.ts   export and import every month
 * The router has already checked the request against the endpoint, so the operation gets
 * its params and body typed and in range.
 */
export type Operation<Name extends EndpointName> = (
  request: OperationRequest<Name>,
  context: OperationContext,
) => Promise<ResponseOf<Name>>;
