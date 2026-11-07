/** Reading every month for a backup, and importing one. (Opening a month is in sync/month-page-state.ts.) */
import type { ExportResponse, ImportResponse } from '../../../shared/api/endpoints.ts';
import { callEndpoint } from './endpoint-http-client.ts';

/** GET /api/export: every saved month, for a backup file. */
export function exportMonths(): Promise<ExportResponse> {
  return callEndpoint('exportMonths', {}, undefined);
}

/** POST /api/import: replaces the months in a backup file. */
export function importMonths(months: unknown[]): Promise<ImportResponse> {
  return callEndpoint('importMonths', {}, { months });
}
