/** Operations that only read: they change nothing and broadcast nothing. */
import { buildMonthResponse } from '../operation-context.ts';
import type { Operation } from './operation.ts';

/** GET /api/months/:month: the month, created from the closest saved month if it doesn't exist yet. */
export const getMonthOperation: Operation<'getMonth'> = async ({ params }, context) => {
  const month = await context.monthRepository.loadMonthOrCreateFromClosestMonth(params.month);
  return buildMonthResponse(context, month);
};
