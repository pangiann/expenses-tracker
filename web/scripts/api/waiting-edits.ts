import { endpoints, type EndpointName } from '../../../shared/api/endpoints.ts';
import {
  applyMonthEdit,
  isMonthEdit,
  type MonthEditName,
  type MonthEditRequest,
} from '../../../shared/api/month-edit-per-endpoint.ts';
import { MonthRecord, MonthRuleError, type MonthData } from '../../../shared/month/month-record.ts';

/** An edit in the outbox that the server hasn't answered yet. */
export interface WaitingEdit {
  name: EndpointName;
  params: Record<string, string>;
  body: unknown;
}

/**
 * The month to show: the server's last answer, with the edits still waiting in the outbox
 * applied on top, in order. So an edit shows at once, also without a connection. The edits
 * are the same functions the server runs (shared/api/month-edits.ts); when the server's
 * answer arrives, its edit leaves the outbox and the server's month takes over.
 *
 * An edit that no longer fits (for example its category was removed by someone else) is
 * skipped here; the server refuses it too, and the outbox drops it.
 */
export function monthWithWaitingEdits(serverMonth: MonthData, edits: readonly WaitingEdit[]): MonthRecord {
  const month = new MonthRecord(serverMonth);
  for (const edit of edits) {
    if (edit.params.month !== month.monthKey || !isMonthEdit(edit.name)) continue;
    const request = checkedRequest(edit.name, edit);
    if (!request) continue;
    try {
      applyMonthEdit(month, edit.name, request);
    } catch (error) {
      if (!(error instanceof MonthRuleError)) throw error;
    }
  }
  return month;
}

/** The edit's params and body after checking, with defaults filled in (for example an empty description). */
function checkedRequest(name: MonthEditName, edit: WaitingEdit): MonthEditRequest<MonthEditName> | null {
  const params = endpoints[name].params.safeParse(edit.params);
  const body = endpoints[name].body.safeParse(edit.body);
  return params.success && body.success ? { params: params.data, body: body.data } : null;
}
