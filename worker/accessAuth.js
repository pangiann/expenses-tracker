import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies the Cloudflare Access login on a request and returns the user's email.
 *
 * Cloudflare Access sits in front of the Worker: it asks for an email, sends a one-time
 * code, and then adds a signed token (a JWT) to every request in the
 * Cf-Access-Jwt-Assertion header. Verifying that signature here means a request that
 * somehow skips Access (a misconfigured route, a forgotten policy) is still refused.
 *
 * Needs two settings in the Cloudflare dashboard (never in git):
 *   ACCESS_TEAM_DOMAIN  for example https://your-team.cloudflareaccess.com
 *   ACCESS_AUD          the application's "Application Audience (AUD) Tag"
 * Without them every request is refused.
 */
export class AccessDeniedError extends Error {}

const keySetsByTeamDomain = new Map(); // cached per Worker instance

/**
 * @param {Request} request
 * @param {object} env  Worker environment
 * @returns {Promise<string>} the signed-in user's email, lowercase
 * @throws {AccessDeniedError}
 */
export async function verifiedUserEmail(request, env) {
  const testEmail = localTestBypassEmail(request, env);
  if (testEmail) return testEmail;

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!teamDomain || !audience) {
    throw new AccessDeniedError('Cloudflare Access is not configured for this Worker');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AccessDeniedError('Missing Cloudflare Access token');

  try {
    const { payload } = await jwtVerify(token, keySetFor(teamDomain), { issuer: teamDomain, audience });
    if (typeof payload.email !== 'string' || payload.email === '') {
      throw new AccessDeniedError('Access token has no email');
    }
    return payload.email.toLowerCase();
  } catch (error) {
    if (error instanceof AccessDeniedError) throw error;
    throw new AccessDeniedError(`Invalid Cloudflare Access token: ${error.message}`);
  }
}

function keySetFor(teamDomain) {
  if (!keySetsByTeamDomain.has(teamDomain)) {
    keySetsByTeamDomain.set(teamDomain, createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`)));
  }
  return keySetsByTeamDomain.get(teamDomain);
}

/**
 * For `wrangler dev` on your own computer, where Access doesn't exist.
 * Off unless ACCESS_TEST_BYPASS_EMAIL is set (in the git-ignored .dev.vars file),
 * and refused for any host other than localhost, so it can't work on the real site.
 */
function localTestBypassEmail(request, env) {
  const bypassEmail = env.ACCESS_TEST_BYPASS_EMAIL;
  if (!bypassEmail) return null;
  const { hostname } = new URL(request.url);
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
  return bypassEmail.toLowerCase();
}
