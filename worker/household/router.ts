// zod/mini has the same checks as zod in a form bundlers can trim (see shared/api/fields.ts).
import * as z from 'zod/mini';

import { endpoints, matchPath, type EndpointName, type ErrorResponse } from '../../shared/api/endpoints.ts';
import { MonthRuleError } from '../../shared/month/month-record.ts';
import { handlers } from './handlers/index.ts';
import type { Handler } from './handlers/handler.ts';
import { InvalidImportError } from './handlers/months.ts';
import type { Household } from './household.ts';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // a backup of many years fits easily

/**
 * Turns an HTTP request into a handler call:
 *   1. find the endpoint whose method and path match (shared/api/endpoints.ts), else 404
 *   2. check the path parameters and the JSON body against the endpoint, else 400
 *   3. call the handler with the same name (handlers/), and answer with its result as JSON
 * A handler that throws MonthRuleError answers 409 with the rule that was broken.
 */
export async function routeRequest(request: Request, household: Household): Promise<Response> {
  const { pathname } = new URL(request.url);
  for (const name of Object.keys(endpoints) as EndpointName[]) {
    const endpoint = endpoints[name];
    if (endpoint.method !== request.method) continue;
    const rawParams = matchPath(endpoint.path, pathname);
    if (rawParams) return runEndpoint(name, rawParams, request, household);
  }
  return errorResponse(404, { error: 'Not found' });
}

async function runEndpoint(
  name: EndpointName,
  rawParams: Record<string, string>,
  request: Request,
  household: Household,
): Promise<Response> {
  const endpoint = endpoints[name];
  const params = endpoint.params.safeParse(rawParams);
  if (!params.success) return errorResponse(400, { error: `Invalid path: ${z.prettifyError(params.error)}` });

  const rawBody = await readJsonBody(request);
  if (rawBody instanceof Response) return rawBody;
  const body = endpoint.body.safeParse(rawBody);
  if (!body.success) return errorResponse(400, { error: `Invalid request: ${z.prettifyError(body.error)}` });

  // Each endpoint's handler expects that endpoint's params and body, which were just checked.
  const handler = handlers[name] as Handler<EndpointName>;
  try {
    const result = await handler({ params: params.data, body: body.data }, household);
    return jsonResponse(200, result);
  } catch (error) {
    if (error instanceof MonthRuleError) return errorResponse(409, { error: error.message, rule: error.rule });
    if (error instanceof InvalidImportError) return errorResponse(400, { error: error.message });
    console.error(`${name} failed`, error);
    return errorResponse(500, { error: 'Something went wrong' });
  }
}

/** The parsed JSON body; undefined when there is none; an error Response when it can't be read. */
async function readJsonBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return errorResponse(413, { error: 'Request too large' });
  }
  const text = await request.text();
  if (text === '') return undefined;
  if (text.length > MAX_BODY_BYTES) return errorResponse(413, { error: 'Request too large' });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return errorResponse(400, { error: 'Body is not JSON' });
  }
}

function errorResponse(status: number, body: ErrorResponse): Response {
  return jsonResponse(status, body);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
