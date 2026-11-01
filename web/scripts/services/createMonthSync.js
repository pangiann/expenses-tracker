import { CloudMonthSync } from './CloudMonthSync.js';
import { LocalMonthSync } from './LocalMonthSync.js';

/**
 * Picks the backend. web/backend.json says "cloud"; the local Python server answers
 * that same path with "local" (see server/request_handler.py). On Cloudflare it is a
 * static file, so reading it costs no request from the free quota.
 */
export async function createMonthSync(callbacks) {
  const response = await fetch('backend.json', { cache: 'no-store' });
  const { mode } = await response.json();
  return mode === 'local' ? new LocalMonthSync(callbacks) : new CloudMonthSync(callbacks);
}
