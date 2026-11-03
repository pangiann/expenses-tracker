/**
 * Cloudflare Worker entry point.
 *
 *   /api/live    WebSocket to the signed-in user's household (see HouseholdRoom)
 *   /api/status  why the WebSocket was refused; the page asks only after a failed connection
 *   /api/months/..., /api/export, /api/import
 *                the app's endpoints (shared/api/endpoints.ts), answered by the household
 *   /api/...     anything else: 404
 *   everything else: static files from web/ (served by Cloudflare without running this code)
 *
 * Only the default handler and Durable Object classes may be exported from this module.
 */
import { AccessDeniedError, verifiedUserEmail } from './accessAuth.js';
import { HouseholdRoom } from './HouseholdRoom.js';
import { UnknownMemberError, householdForEmail } from './households.js';

export { HouseholdRoom };

const LIVE_PATH = '/api/live';
const STATUS_PATH = '/api/status';
const ENDPOINT_PATHS = ['/api/export', '/api/import'];
const ENDPOINT_PATH_PREFIX = '/api/months/';

export default {
  /**
   * @param {Request} request
   * @param {{ HOUSEHOLD: DurableObjectNamespace, ASSETS: Fetcher }} env
   * @param {ExecutionContext} context  context.access identifies the signed-in user
   */
  async fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    if (pathname === LIVE_PATH) return openHouseholdConnection(request, env, context);
    if (pathname === STATUS_PATH) return describeAccess(request, env, context);
    if (pathname.startsWith(ENDPOINT_PATH_PREFIX) || ENDPOINT_PATHS.includes(pathname)) {
      return callHouseholdEndpoint(request, env, context);
    }
    if (pathname.startsWith('/api/')) return textResponse('Not found', 404);
    return env.ASSETS.fetch(request);
  },
};

async function openHouseholdConnection(request, env, context) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return textResponse('Connect with a WebSocket', 426);
  }
  // A browser sends the login cookie with WebSockets opened by any website, so only
  // accept connections opened by this site's own page.
  if (!isSameOriginRequest(request)) {
    return textResponse('Forbidden', 403);
  }
  return forwardToHousehold(request, env, context);
}

/**
 * An endpoint call. A browser sends the login cookie with requests that other websites
 * start too, so an edit (anything but GET) must come from this site's own page. Browsers
 * also say where a request comes from (Sec-Fetch-Site); requests started by another site
 * are refused, reads included. Tools such as curl send neither header; an edit from curl
 * needs `-H "Origin: <site>"`.
 */
async function callHouseholdEndpoint(request, env, context) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  const isFromAnotherSite = fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none';
  if (isFromAnotherSite || (request.method !== 'GET' && !isSameOriginRequest(request))) {
    return textResponse('Forbidden', 403);
  }
  return forwardToHousehold(request, env, context);
}

/** Checks the sign-in, finds the user's household, and lets its Durable Object answer. */
async function forwardToHousehold(request, env, context) {
  let householdName;
  try {
    const email = await verifiedUserEmail(request, env, context);
    householdName = householdForEmail(email, env);
  } catch (error) {
    if (error instanceof AccessDeniedError || error instanceof UnknownMemberError) {
      console.warn(error.message);
      return textResponse('Forbidden', 403);
    }
    throw error;
  }

  const household = env.HOUSEHOLD.get(env.HOUSEHOLD.idFromName(householdName));
  return household.fetch(request);
}

/**
 * Tells the signed-in user why they can't connect, for example that their email isn't in
 * any household yet. Reveals nothing to strangers: Cloudflare Access stops them first.
 */
async function describeAccess(request, env, context) {
  let email;
  try {
    email = await verifiedUserEmail(request, env, context);
  } catch (error) {
    // The reason helps fix the setup; it names the failed check, never a secret value.
    if (error instanceof AccessDeniedError) return jsonResponse({ problem: error.problem, reason: error.message }, 403);
    throw error;
  }
  try {
    householdForEmail(email, env);
  } catch (error) {
    if (error instanceof UnknownMemberError) return jsonResponse({ problem: 'not-a-member', email }, 403);
    throw error;
  }
  return jsonResponse({ email }, 200);
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function textResponse(text, status) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } });
}
