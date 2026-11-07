import {
  endpoints,
  buildRequestPath,
  type RequestBodyInputOf,
  type EndpointName,
  type ErrorResponse,
  type PathParamsOf,
  type ResponseOf,
} from '../../../shared/api/endpoints.ts';
import type { MonthRule } from '../../../shared/month/month-record.ts';

/** The server answered with an error (see ErrorResponse in shared/api/endpoints.ts). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** for 409: the rule of the month that the edit breaks */
    readonly rule?: MonthRule,
  ) {
    super(message);
  }
}

/** The request didn't reach the server, or the server is briefly unavailable: try again later. */
export class OfflineError extends Error {}

/** The request doesn't match its endpoint, so it isn't sent; for example an empty amount. */
export class InvalidRequestError extends Error {}

/** Cloudflare answers these while the Worker is restarting or briefly overloaded. */
const TEMPORARY_STATUSES = new Set([502, 503, 504]);

/** True when the body matches its endpoint, checked without sending it. */
export function isValidBody<Name extends EndpointName>(name: Name, body: RequestBodyInputOf<Name>): boolean {
  return endpoints[name].body.safeParse(body).success;
}

/**
 * Calls one endpoint of shared/api/endpoints.ts and returns its answer.
 * @throws {InvalidRequestError} before sending, when the body doesn't match the endpoint
 * @throws {OfflineError} when the server can't be reached
 * @throws {ApiError} when the server refuses the request
 */
export async function callEndpoint<Name extends EndpointName>(
  name: Name,
  params: PathParamsOf<Name>,
  body: RequestBodyInputOf<Name>,
): Promise<ResponseOf<Name>> {
  if (!isValidBody(name, body)) throw new InvalidRequestError(`Invalid ${name} request`);
  const endpoint = endpoints[name];
  let response: Response;
  try {
    response = await fetch(buildRequestPath(endpoint.path, params), {
      method: endpoint.method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    // No connection, or the sign-in expired and Cloudflare redirected the request to its login page.
    throw new OfflineError(`${name}: no answer`);
  }
  if (TEMPORARY_STATUSES.has(response.status)) throw new OfflineError(`${name}: ${response.status}`);
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: response.statusText }))) as ErrorResponse;
    throw new ApiError(response.status, error.error, error.rule);
  }
  return (await response.json()) as ResponseOf<Name>;
}
