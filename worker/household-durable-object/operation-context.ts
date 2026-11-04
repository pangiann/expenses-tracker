import type { MonthResponse } from '../../shared/api/endpoints.ts';
import type { MonthRecord } from '../../shared/month/month-record.ts';
import type { DurableObjectMonthRepository } from './durable-object-month-repository.ts';
import type { LiveUpdateConnectionManager } from './live-update-connection-manager.ts';

/**
 * What every operation receives besides the request: the tools of the household whose
 * Durable Object is running. worker-entry-point.ts already chose the household from the
 * signed-in email, so an operation never looks a household up; it can only reach this one.
 */
export interface OperationContext {
  /** this household's months, in its Durable Object storage */
  monthRepository: DurableObjectMonthRepository;
  /** this household's open pages, for live updates */
  liveUpdateConnections: LiveUpdateConnectionManager;
}

/** The answer for a month: the month as saved, every saved month key, and the latest revision. */
export async function buildMonthResponse(context: OperationContext, month: MonthRecord): Promise<MonthResponse> {
  return {
    month: month.toJSON(),
    monthKeys: await context.monthRepository.savedMonthKeys(),
    revision: await context.monthRepository.latestRevision(),
  };
}
