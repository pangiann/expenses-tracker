/**
 * The spending categories a new household starts with, in display order.
 *
 * Each month stores its own list of categories (see MonthRecord), so people can add,
 * rename, remove and reorder them; a new month copies the list of the month before.
 * These defaults are used for a brand-new household and for older months saved before
 * months had their own list.
 *
 * `id` is what expenses store in their `category` field. Default categories have a
 * `nameId`, a string id in web/i18n/*.json, so they show in the page language.
 * Categories people create store a `name` instead.
 */
export const DEFAULT_CATEGORIES = Object.freeze([
  { id: 'dinner',        nameId: 'category.dinner',        color: '#e8618c' },
  { id: 'lunch',         nameId: 'category.lunch',         color: '#f39c38' },
  { id: 'supermarket',   nameId: 'category.supermarket',   color: '#22a879' },
  { id: 'transport',     nameId: 'category.transport',     color: '#4f6bed' }, // getting around town
  { id: 'travel',        nameId: 'category.travel',        color: '#0ea5e9' }, // trips, flights, ferries
  { id: 'entertainment', nameId: 'category.entertainment', color: '#9b59d0' },
  { id: 'health',        nameId: 'category.health',        color: '#84cc16' }, // gym, pharmacy, haircuts
  { id: 'home',          nameId: 'category.home',          color: '#14b8a6' },
  { id: 'clothes',       nameId: 'category.clothes',       color: '#b7791f' },
  { id: 'gifts',         nameId: 'category.gifts',         color: '#a21caf' },
  { id: 'other',         nameId: 'category.other',         color: '#8a92a6' },
]);

/** The two lists of recurring costs. Values are the field names in the month file. */
export const RecurringCostList = Object.freeze({
  FIXED_COSTS: 'fixed',
  SUBSCRIPTIONS: 'subscriptions',
});

/**
 * Fixed costs a brand-new household starts with. The server creates these too, and it has
 * no language, so they are stored in English; people rename them as they like.
 */
export const DEFAULT_FIXED_COST_NAMES = ['Rent', 'Internet', 'Electricity'];
