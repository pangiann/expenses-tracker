/**
 * Spending categories, in display order.
 * `key` is what the month files store (in `budgets` and in each expense's `category`).
 */
export const SPENDING_CATEGORIES = [
  { key: 'dinner',        displayName: 'Dinner/Drinks',   color: '#e8618c' },
  { key: 'lunch',         displayName: 'Lunch',           color: '#f39c38' },
  { key: 'supermarket',   displayName: 'Supermarket',     color: '#22a879' },
  { key: 'transport',     displayName: 'Transport',       color: '#4f6bed' }, // getting around town
  { key: 'travel',        displayName: 'Travel',          color: '#0ea5e9' }, // trips, flights, ferries
  { key: 'entertainment', displayName: 'Entertainment',   color: '#9b59d0' },
  { key: 'health',        displayName: 'Health & sport',  color: '#84cc16' }, // gym, pharmacy, haircuts
  { key: 'home',          displayName: 'Home',            color: '#14b8a6' },
  { key: 'clothes',       displayName: 'Clothes',         color: '#b7791f' },
  { key: 'gifts',         displayName: 'Gifts',           color: '#a21caf' },
  { key: 'other',         displayName: 'Other',           color: '#8a92a6' },
];

/** The two lists of recurring costs. Values are the field names in the month file. */
export const RecurringCostList = Object.freeze({
  FIXED_COSTS: 'fixed',
  SUBSCRIPTIONS: 'subscriptions',
});

/** Fixed costs a brand-new user starts with. */
export const DEFAULT_FIXED_COST_NAMES = ['Rent', 'Internet', 'Electricity'];
