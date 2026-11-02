/**
 * Spending categories, in display order.
 * `key` is what the month files store (in `budgets` and in each expense's `category`).
 * Display names are translations: string id `category.<key>` in web/i18n/*.json.
 */
export const SPENDING_CATEGORIES = [
  { key: 'dinner',        color: '#e8618c' },
  { key: 'lunch',         color: '#f39c38' },
  { key: 'supermarket',   color: '#22a879' },
  { key: 'transport',     color: '#4f6bed' }, // getting around town
  { key: 'travel',        color: '#0ea5e9' }, // trips, flights, ferries
  { key: 'entertainment', color: '#9b59d0' },
  { key: 'health',        color: '#84cc16' }, // gym, pharmacy, haircuts
  { key: 'home',          color: '#14b8a6' },
  { key: 'clothes',       color: '#b7791f' },
  { key: 'gifts',         color: '#a21caf' },
  { key: 'other',         color: '#8a92a6' },
];

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
