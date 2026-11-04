import type { BodyOf, EndpointName, ParamsOf, ResponseOf } from '../../../shared/api/endpoints.ts';
import type { OperationContext } from '../operation-context.ts';

/** The checked path parameters and body of one endpoint's request. */
export interface OperationRequest<Name extends EndpointName> {
  params: ParamsOf<Name>;
  body: BodyOf<Name>;
}

/**
 * The function that answers one endpoint of shared/api/endpoints.ts. There is one file per
 * operation in this folder, named after the endpoint (addExpense -> add-expense-operation.ts).
 * The router has already checked the request against the endpoint, so the operation gets
 * its params and body typed and in range.
 */
export type Operation<Name extends EndpointName> = (
  request: OperationRequest<Name>,
  context: OperationContext,
) => Promise<ResponseOf<Name>>;
