import { endpoints } from '../../../shared/api/endpoints.ts';
import {
  applyEditToMonth,
  isMonthEdit,
  type MonthEditName,
  type MonthEditRequest,
} from '../../../shared/month/apply-edit-to-month.ts';
import { MonthRecord, MonthRuleError, type MonthData } from '../../../shared/month/month-record.ts';
import type { UnsavedEdit } from './unsaved-edits-outbox.ts';

/**
 * The month to show while some edits aren't saved yet: an optimistic update. It starts from
 * the month the server last saved and applies the unsaved edits on top, in order, so an edit
 * shows the moment it is made, also offline. The edits are the same functions the Worker runs
 * (shared/month/apply-edit-to-month.ts), so this guess matches what the server will save.
 *
 * An edit that no longer fits (for example its category was removed by someone else) is
 * skipped here; the server refuses it too.
 */
export function buildOptimisticMonth(savedMonth: MonthData, unsavedEdits: readonly UnsavedEdit[]): MonthRecord {
  const month = new MonthRecord(savedMonth);
  for (const edit of unsavedEdits) {
    if (edit.params.month !== month.monthKey || !isMonthEdit(edit.name)) continue;
    const request = checkedRequest(edit.name, edit);
    if (!request) continue;
    try {
      applyEditToMonth(month, edit.name, request);
    } catch (error) {
      if (!(error instanceof MonthRuleError)) throw error;
    }
  }
  return month;
}

/** The edit's params and body after checking, with defaults filled in (for example an empty description). */
function checkedRequest(name: MonthEditName, edit: UnsavedEdit): MonthEditRequest<MonthEditName> | null {
  const params = endpoints[name].params.safeParse(edit.params);
  const body = endpoints[name].body.safeParse(edit.body);
  return params.success && body.success ? { params: params.data, body: body.data } : null;
}
