/**
 * The shapes of the fields that requests carry: ids, amounts, text, dates. Every endpoint
 * builds its request body from these, so the same limits apply everywhere.
 */
// zod/mini has the same checks as zod in a form bundlers can trim: about 7 KB in the page instead of 90 KB.
import * as z from 'zod/mini';

import { RecurringCostList } from '../month/categories.ts';
import { MONTH_KEY_PATTERN } from '../month/month-validation.ts';

const MAX_AMOUNT = 10_000_000;
const MAX_TEXT_LENGTH = 200;
const MAX_ID_LENGTH = 64;

export const ItemIdField = z.string().check(z.minLength(1), z.maxLength(MAX_ID_LENGTH));
/** 0 or more, for budgets and fixed costs */
export const NonNegativeAmountField = z.number().check(z.gte(0), z.lte(MAX_AMOUNT));
/** more than 0, for expenses and income */
export const PositiveAmountField = z.number().check(z.gt(0), z.lte(MAX_AMOUNT));
/** Required text: at least one character that isn't a space. */
export const RequiredTextField = z.string().check(
  z.maxLength(MAX_TEXT_LENGTH),
  z.refine((text) => text.trim() !== '', 'Text is empty'),
);
/** Optional text; a missing description becomes ''. */
export const OptionalTextField = z.pipe(
  z.nullish(z.string().check(z.maxLength(MAX_TEXT_LENGTH))),
  z.transform((text) => text ?? ''),
);
export const IsoDateField = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
export const RecurringCostListNameField = z.enum([RecurringCostList.FIXED_COSTS, RecurringCostList.SUBSCRIPTIONS]);

/** "YYYY-MM" */
export const MonthKeyField = z.string().check(z.regex(MONTH_KEY_PATTERN));
/** "YYYY", as it appears in a path */
export const YearField = z.string().check(z.regex(/^\d{4}$/));
