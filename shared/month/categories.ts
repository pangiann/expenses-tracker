/**
 * The spending categories a new household starts with, in display order.
 *
 * Each month stores its own list of categories (see MonthRecord), so people can add,
 * rename, remove and reorder them; a new month copies the list of the month before.
 * These defaults are used for a brand-new household.
 *
 * `id` is what expenses store in their `category` field. Default categories have a
 * `nameId`, a string id in web/i18n/*.json, so they show in the page language.
 * Categories people create store a `name` instead.
 */
export interface Category {
  id: string;
  /** Default categories: the string id of the translated name. */
  nameId?: string;
  /** Categories people created or renamed: the name they typed. */
  name?: string;
}

export const DEFAULT_CATEGORIES: readonly Readonly<Category>[] = Object.freeze([
  { id: 'dinner', nameId: 'category.dinner' },
  { id: 'lunch', nameId: 'category.lunch' },
  { id: 'supermarket', nameId: 'category.supermarket' },
  { id: 'transport', nameId: 'category.transport' }, // getting around town
  { id: 'travel', nameId: 'category.travel' }, // trips, flights, ferries
  { id: 'entertainment', nameId: 'category.entertainment' },
  { id: 'health', nameId: 'category.health' }, // gym, pharmacy, haircuts
  { id: 'home', nameId: 'category.home' },
  { id: 'clothes', nameId: 'category.clothes' },
  { id: 'gifts', nameId: 'category.gifts' },
  { id: 'other', nameId: 'category.other' },
]);

/** Longest category name: what fits on one line of a card next to the amount, also on a phone. */
export const MAX_CATEGORY_NAME_LENGTH = 20;

/** The most categories a month can have; the page stays usable well below this. */
export const MAX_CATEGORIES_PER_MONTH = 40;

/** The two lists of recurring costs. Values are the field names in the month file. */
export const RecurringCostList = Object.freeze({
  FIXED_COSTS: 'fixed',
  SUBSCRIPTIONS: 'subscriptions',
} as const);

/** 'fixed' or 'subscriptions' */
export type RecurringCostListName = (typeof RecurringCostList)[keyof typeof RecurringCostList];

/**
 * Fixed costs a brand-new household starts with. The server creates these too, and it has
 * no language, so they are stored in English; people rename them as they like.
 */
export const DEFAULT_FIXED_COST_NAMES: readonly string[] = ['Rent', 'Internet', 'Electricity'];
