import type { ExportResponse, ImportResponse, MonthResponse } from '../../../shared/api/endpoints.ts';
import { callEndpoint } from './http.ts';

/** GET /api/months/:month: the month, created on the server if it doesn't exist yet. */
export function getMonth(monthKey: string): Promise<MonthResponse> {
  return callEndpoint('getMonth', { month: monthKey }, undefined);
}

/** GET /api/export: every saved month, for a backup file. */
export function exportMonths(): Promise<ExportResponse> {
  return callEndpoint('exportMonths', {}, undefined);
}

/** POST /api/import: replaces the months in a backup file. */
export function importMonths(months: unknown[]): Promise<ImportResponse> {
  return callEndpoint('importMonths', {}, { months });
}
