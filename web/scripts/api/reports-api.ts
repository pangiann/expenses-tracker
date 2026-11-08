/** Reading a year's totals for the reports page. It changes nothing, so it goes straight to the server. */
import type { YearSummary } from '../../../shared/month/year-summary.ts';
import { callEndpoint } from './endpoint-http-client.ts';

/** GET /api/years/:year/summary */
export function loadYearSummary(year: number): Promise<YearSummary> {
  return callEndpoint('getYearSummary', { year: String(year) }, undefined);
}
