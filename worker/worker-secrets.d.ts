// Secrets the Worker reads, set in the Cloudflare dashboard (and in .dev.vars for `npm run dev`).
// `npm run types` only lists the bindings in wrangler.jsonc, so the secrets are declared here.
declare namespace Cloudflare {
  interface Env {
    /** JSON from email to household name, see households.ts */
    HOUSEHOLD_MEMBERS?: string;
    /** Optional: verify the Access token ourselves, see access-auth.ts */
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    /** Local testing only, see access-auth.ts */
    ACCESS_TEST_BYPASS_EMAIL?: string;
  }
}
