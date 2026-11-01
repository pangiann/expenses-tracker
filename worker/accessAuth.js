import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Finds out who is signed in, using Cloudflare Access.
 *
 * Access sits in front of the Worker: it asks for an email (or a Cloudflare login) and
 * only lets the request through after the person signs in. Cloudflare then tells the
 * Worker who it is through ctx.access, which is undefined when Access did not
 * authenticate the request. Without a signed-in user, every request is refused.
 *
 * Fallback: if ctx.access isn't available, the Worker can verify the signed Access token
 * itself when the secrets ACCESS_TEAM_DOMAIN and ACCESS_AUD are set. They are optional.
 */

/** Why a request was refused, shown to the signed-in user so they know what to fix. */
export const AccessProblem = Object.freeze({
  NOT_ENABLED: 'access-not-enabled',
  INVALID_TOKEN: 'invalid-sign-in',
});

export class AccessDeniedError extends Error {
  constructor(message, problem) {
    super(message);
    this.problem = problem;
  }
}

const keySetsByTeamDomain = new Map(); // cached per Worker instance

/**
 * @param {Request} request
 * @param {object} env  Worker environment
 * @param {ExecutionContext} context  Worker context; context.access is set by Cloudflare Access
 * @returns {Promise<string>} the signed-in user's email, lowercase
 * @throws {AccessDeniedError}
 */
export async function verifiedUserEmail(request, env, context) {
  const testEmail = localTestBypassEmail(request, env);
  if (testEmail) return testEmail;

  if (context?.access) {
    const identity = await context.access.getIdentity();
    return requireEmail(identity?.email);
  }
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    return requireEmail(await emailFromAccessToken(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD));
  }
  throw new AccessDeniedError('Cloudflare Access did not authenticate this request', AccessProblem.NOT_ENABLED);
}

function requireEmail(email) {
  if (typeof email !== 'string' || email === '') {
    throw new AccessDeniedError('The sign-in has no email', AccessProblem.INVALID_TOKEN);
  }
  return email.toLowerCase();
}

/** Verifies the signed token Access adds in the Cf-Access-Jwt-Assertion header. */
async function emailFromAccessToken(request, teamDomain, audience) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AccessDeniedError('Missing Cloudflare Access token', AccessProblem.NOT_ENABLED);
  try {
    const { payload } = await jwtVerify(token, keySetFor(teamDomain), { issuer: teamDomain, audience });
    return payload.email;
  } catch (error) {
    throw new AccessDeniedError(`Invalid Cloudflare Access token: ${error.message}`, AccessProblem.INVALID_TOKEN);
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
