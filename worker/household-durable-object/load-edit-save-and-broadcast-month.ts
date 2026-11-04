import type { MonthResponse } from '../../shared/api/endpoints.ts';
import type { MonthRecord } from '../../shared/month/month-record.ts';
import { buildMonthResponse, type OperationContext } from './operation-context.ts';

/**
 * The four steps of every operation that edits a month:
 *   1. load the month (created from the closest saved month if it doesn't exist yet),
 *   2. apply the edit,
 *   3. save the month,
 *   4. send the new month to every device showing it,
 * and answer with that month. `applyEdit` throws MonthRuleError when the edit breaks a rule
 * of the month; then nothing is saved.
 */
export async function loadEditSaveAndBroadcastMonth(
  context: OperationContext,
  monthKey: string,
  applyEdit: (month: MonthRecord) => void,
): Promise<MonthResponse> {
  const month = await context.monthRepository.loadMonthOrCreateFromClosestMonth(monthKey);
  applyEdit(month);
  await context.monthRepository.saveMonth(month);
  const response = await buildMonthResponse(context, month);
  context.liveUpdateConnections.sendMonthToDevicesWatchingIt(response);
  return response;
}
