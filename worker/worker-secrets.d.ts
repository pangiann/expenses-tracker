// Secrets the Worker reads, set in the Cloudflare dashboard (and in .dev.vars for `npm run dev`).
// `npm run types` only lists the bindings in wrangler.jsonc, so the secrets are declared here.
// worker-configuration.d.ts declares the bindings twice, as the global Env and as Cloudflare.Env,
// so the secrets are added to both.
interface WorkerSecrets {
  /** JSON from email to household name, see sign-in/household-membership-lookup.ts */
  HOUSEHOLD_MEMBERS?: string;
  /** Optional: verify the Access token ourselves, see sign-in/signed-in-user-resolver.ts */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Local testing only, see sign-in/signed-in-user-resolver.ts */
  ACCESS_TEST_BYPASS_EMAIL?: string;
}

// Adding members to an existing interface needs interface syntax, even with no members of its own.
/* eslint-disable @typescript-eslint/no-empty-object-type */
interface Env extends WorkerSecrets {}

declare namespace Cloudflare {
  interface Env extends WorkerSecrets {}
}
