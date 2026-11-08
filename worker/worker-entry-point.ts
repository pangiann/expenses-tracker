/**
 * The Worker's entry point: every request to the site arrives here first.
 *
 *   /api/live                                  live-update WebSocket to the signed-in user's household
 *   /api/months/..., /api/export, /api/import  the app's endpoints (shared/api/endpoints.ts)
 *   /api/status                                why the sign-in was refused; the page asks after a failed connection
 *   /api/...                                   anything else: 404
 *   everything else                            the page's files from web/ (served by Cloudflare without running this code)
 *
 * For the WebSocket and the endpoints, it checks where the request came from and who is
 * signed in, finds their household, and forwards the request to that household's Durable
 * Object (household-durable-object/), which answers it.
 *
 * Only the default handler and Durable Object classes may be exported from this module.
 */
import { HouseholdDurableObject } from './household-durable-object/household-durable-object.ts';
import { UnknownMemberError, findHouseholdNameForEmail } from './sign-in/household-membership-lookup.ts';
import { isRequestFromAnotherSite, isRequestFromOwnPage } from './sign-in/same-origin-request-check.ts';
import {
  AccessDeniedError,
  resolveSignedInUserEmail,
  type CloudflareAccessContext,
} from './sign-in/signed-in-user-resolver.ts';

// Cloudflare stores every household's months under the class name "HouseholdRoom" (wrangler.jsonc),
// the class's name when it was first deployed. Exporting it under that name keeps the data.
export { HouseholdDurableObject as HouseholdRoom };

const LIVE_UPDATE_PATH = '/api/live';
const SIGN_IN_STATUS_PATH = '/api/status';
const API_ENDPOINT_PATHS = ['/api/export', '/api/import'];
const API_ENDPOINT_PATH_PREFIXES = ['/api/months/', '/api/years/'];

/** The Worker context; context.access identifies the signed-in user (see sign-in/signed-in-user-resolver.ts). */
type WorkerContext = ExecutionContext & CloudflareAccessContext;

export default {
  async fetch(request, env, context: WorkerContext) {
    const { pathname } = new URL(request.url);
    if (pathname === LIVE_UPDATE_PATH) return openLiveUpdateConnection(request, env, context);
    if (pathname === SIGN_IN_STATUS_PATH) return explainSignInStatus(request, env, context);
    if (
      API_ENDPOINT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      API_ENDPOINT_PATHS.includes(pathname)
    ) {
      return handleApiEndpointRequest(request, env, context);
    }
    if (pathname.startsWith('/api/')) return textResponse('Not found', 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** A page opening its live-update WebSocket; only this site's own page may. */
async function openLiveUpdateConnection(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  if (request.headers.get('Upgrade') !== 'websocket') return textResponse('Connect with a WebSocket', 426);
  if (!isRequestFromOwnPage(request)) return textResponse('Forbidden', 403);
  return forwardToHouseholdDurableObject(request, env, context);
}

/**
 * An endpoint call. Requests another website started are refused, reads included, and an
 * edit (anything but GET) must come from this site's own page. An edit from curl needs
 * `-H "Origin: <site>"`.
 */
async function handleApiEndpointRequest(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  if (isRequestFromAnotherSite(request) || (request.method !== 'GET' && !isRequestFromOwnPage(request))) {
    return textResponse('Forbidden', 403);
  }
  return forwardToHouseholdDurableObject(request, env, context);
}

/**
 * Finds who is signed in and their household, and lets that household's Durable Object
 * answer. The household name is the Durable Object's id: the same name always reaches the
 * same Durable Object and its storage, and no other household's.
 */
async function forwardToHouseholdDurableObject(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  let householdName: string;
  try {
    const email = await resolveSignedInUserEmail(request, env, context);
    householdName = findHouseholdNameForEmail(email, env);
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof UnknownMemberError) {
      console.warn(error.message);
      return textResponse('Forbidden', 403);
    }
    throw error;
  }
  const householdDurableObject = env.HOUSEHOLD_DURABLE_OBJECTS.getByName(householdName);
  return householdDurableObject.fetch(request);
}

/**
 * Tells the signed-in user why they can't connect, for example that their email isn't in
 * any household yet. Reveals nothing to strangers: Cloudflare Access stops them first.
 */
async function explainSignInStatus(request: Request, env: Env, context: WorkerContext): Promise<Response> {
  let email: string;
  try {
    email = await resolveSignedInUserEmail(request, env, context);
  } catch (error) {
    // The reason helps fix the setup; it names the failed check, never a secret value.
    if (error instanceof AccessDeniedError) return jsonResponse({ problem: error.problem, reason: error.message }, 403);
    throw error;
  }
  try {
    findHouseholdNameForEmail(email, env);
  } catch (error) {
    if (error instanceof UnknownMemberError) return jsonResponse({ problem: 'not-a-member', email }, 403);
    throw error;
  }
  return jsonResponse({ email }, 200);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function textResponse(text: string, status: number): Response {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } });
}
