import type { BodyOf, EndpointName, ParamsOf, ResponseOf } from '../../../shared/api/endpoints.ts';
import type { Household } from '../household.ts';

/**
 * One handler per endpoint in shared/api/endpoints.ts, with the same name. The router has
 * already checked the path parameters and the body against the endpoint, so a handler gets
 * them typed and in range.
 */
export type Handler<Name extends EndpointName> = (
  request: { params: ParamsOf<Name>; body: BodyOf<Name> },
  household: Household,
) => Promise<ResponseOf<Name>>;
