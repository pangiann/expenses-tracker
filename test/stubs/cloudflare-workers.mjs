/** Stand-in for Cloudflare's 'cloudflare:workers' module when tests run in Node.js. */
export class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
