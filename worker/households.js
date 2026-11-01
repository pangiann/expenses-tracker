/**
 * Which household each signed-in email belongs to. People in the same household share
 * the same months; different households never see each other's data.
 *
 * Set in the Cloudflare dashboard as the secret HOUSEHOLD_MEMBERS (never in git), as JSON
 * from email to household name:
 *   {"me@example.com": "home", "sister@example.com": "sister", "husband@example.com": "sister"}
 */
export class UnknownMemberError extends Error {}

const HOUSEHOLD_NAME_PATTERN = /^[a-z0-9-]{1,40}$/;

/**
 * @param {string} email  verified, lowercase
 * @param {object} env  Worker environment
 * @returns {string} the household name
 * @throws {UnknownMemberError}
 */
export function householdForEmail(email, env) {
  const householdName = parseHouseholdMembers(env.HOUSEHOLD_MEMBERS).get(email);
  if (!householdName) throw new UnknownMemberError(`${email} is not a member of any household`);
  return householdName;
}

/** @returns {Map<string, string>} email -> household name; empty when the setting is missing or invalid */
export function parseHouseholdMembers(settingText) {
  const members = new Map();
  if (!settingText) return members;
  let parsedSetting;
  try {
    parsedSetting = JSON.parse(settingText);
  } catch {
    console.error('HOUSEHOLD_MEMBERS is not valid JSON');
    return members;
  }
  for (const [email, householdName] of Object.entries(parsedSetting ?? {})) {
    if (typeof householdName === 'string' && HOUSEHOLD_NAME_PATTERN.test(householdName)) {
      members.set(email.trim().toLowerCase(), householdName);
    }
  }
  return members;
}
