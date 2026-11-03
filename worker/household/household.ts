import type { MonthResponse } from '../../shared/api/endpoints.ts';
import type { MonthRecord } from '../../shared/month/month-record.ts';
import type { Broadcaster } from './broadcaster.ts';
import type { MonthRepository } from './month-repository.ts';

/** What every handler works with: the household's stored months and its open devices. */
export interface Household {
  months: MonthRepository;
  broadcaster: Broadcaster;
}

/** The answer for a month: the month as saved, every month key, and the latest revision. */
export async function monthResponse(household: Household, month: MonthRecord): Promise<MonthResponse> {
  return {
    month: month.toJSON(),
    monthKeys: await household.months.monthKeys(),
    revision: await household.months.revision(),
  };
}

/**
 * The steps of every edit: load the month (creating it if needed), change it, save it, and
 * send the new month to every device showing it. Returns that month as the answer.
 * `change` throws MonthRuleError when the edit breaks a rule of the month; then nothing is saved.
 */
export async function editMonth(
  household: Household,
  monthKey: string,
  change: (month: MonthRecord) => void,
): Promise<MonthResponse> {
  const month = await household.months.loadOrCreate(monthKey);
  change(month);
  await household.months.save(month);
  const response = await monthResponse(household, month);
  household.broadcaster.sendMonth(response);
  return response;
}
