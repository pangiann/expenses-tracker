import type { MonthRule } from '../../../shared/month/month-record.ts';
import type { ApiError } from '../api/endpoint-http-client.ts';
import { t } from '../i18n/translator.ts';

/** String id of the message for each month rule an edit can break (see MonthRule in shared/month/month-record.ts). */
const RULE_STRING_IDS: Record<MonthRule, string> = {
  'unknown-category': 'error.editRefusedUnknownCategory',
  'date-outside-month': 'error.editRefusedDateOutsideMonth',
  'category-name-empty': 'error.editRefusedCategoryNameEmpty',
  'category-name-too-long': 'error.editRefusedCategoryNameTooLong',
  'category-name-taken': 'error.editRefusedCategoryNameTaken',
  'too-many-categories': 'error.editRefusedTooManyCategories',
  'category-has-expenses': 'error.editRefusedCategoryHasExpenses',
  'last-category': 'error.editRefusedLastCategory',
};

/**
 * Why the server didn't save an edit, for the red banner. Usually someone else changed the
 * month first, for example removed the category the edit was for. Errors without a rule
 * (a request the server couldn't read) get a general message.
 */
export function refusedEditMessage(error: ApiError): string {
  return t(error.rule ? RULE_STRING_IDS[error.rule] : 'error.editRefused');
}
