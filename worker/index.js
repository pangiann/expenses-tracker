/**
 * Cloudflare Worker entry point.
 *
 *   /api/live   WebSocket to the signed-in user's household (see HouseholdRoom)
 *   /api/...    anything else: 404
 *   everything else: static files from web/ (served by Cloudflare without running this code)
 *
 * Only the default handler and Durable Object classes may be exported from this module.
 */
import { AccessDeniedError, verifiedUserEmail } from './accessAuth.js';
import { HouseholdRoom } from './HouseholdRoom.js';
import { UnknownMemberError, householdForEmail } from './households.js';

export { HouseholdRoom };

const LIVE_PATH = '/api/live';

export default {
  /**
   * @param {Request} request
   * @param {{ HOUSEHOLD: DurableObjectNamespace, ASSETS: Fetcher }} env
   */
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === LIVE_PATH) return openHouseholdConnection(request, env);
    if (pathname.startsWith('/api/')) return textResponse('Not found', 404);
    return env.ASSETS.fetch(request);
  },
};

async function openHouseholdConnection(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return textResponse('Connect with a WebSocket', 426);
  }
  // A browser sends the login cookie with WebSockets opened by any website, so only
  // accept connections opened by this site's own page.
  if (!isSameOriginRequest(request)) {
    return textResponse('Forbidden', 403);
  }

  let householdName;
  try {
    const email = await verifiedUserEmail(request, env);
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

export function isSameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function textResponse(text, status) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain' } });
}
