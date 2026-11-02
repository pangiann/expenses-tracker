import {
  CATEGORY_COLOR_PALETTE, DEFAULT_CATEGORIES, DEFAULT_FIXED_COST_NAMES, MAX_CATEGORIES_PER_MONTH, RecurringCostList,
} from '../config/categories.js';
import { roundToCents, sumAmounts } from '../utils/money.js';

/**
 * Everything recorded for one month: income entries, spending categories with their
 * budgets, expenses, fixed costs and subscriptions.
 *
 * This class is the only place that changes month data. It runs in the browser and in
 * the Cloudflare Worker. toJSON() produces the file format:
 *
 *   {
 *     "month": "2026-09",
 *     "income": { "expected": 4000, "actual": 3500,
 *                 "entries": [ { "id": "...", "date": "2026-09-01", "description": "salary", "amount": 3500 } ] },
 *     "categories": [ { "id": "dinner", "nameId": "category.dinner", "color": "#e8618c" },
 *                     { "id": "...", "name": "Kids", "color": "#f59e0b" }, ... ],
 *     "budgets": { "dinner": 100, "lunch": 50, ... },
 *     "expenses": [ { "id": "...", "date": "2026-09-14", "category": "lunch",
 *                     "description": "coffee", "amount": 5.5 } ],
 *     "fixed": [ { "id": "...", "name": "Rent", "amount": 900 } ],
 *     "subscriptions": [ { "id": "...", "name": "Music", "amount": 10 } ]
 *   }
 *
 * "actual" is the sum of the entries. It is still written so older files stay readable.
 * The order of "categories" is the order on screen.
 *
 * Every item (expense, income entry, fixed cost) has an id, and every method finds items by
 * id. Adding an item whose id already exists does nothing, and changing or removing an item
 * that no longer exists does nothing, so applying the same change twice is harmless.
 */
export class MonthRecord {
  /** @param {object} monthData  the parsed contents of a month file */
  constructor(monthData) {
    this.monthKey = monthData.month;
    this.expectedIncome = monthData.income?.expected ?? 0;
    this.incomes = MonthRecord.#readIncomeEntries(monthData);
    this.categories = MonthRecord.#readCategories(monthData);
    this.budgets = { ...MonthRecord.#zeroBudgets(this.categories), ...monthData.budgets };
    this.expenses = (monthData.expenses ?? []).map((expense) => ({ ...expense }));
    this.recurringCosts = {
      [RecurringCostList.FIXED_COSTS]: MonthRecord.#readRecurringCosts(monthData.fixed, RecurringCostList.FIXED_COSTS),
      [RecurringCostList.SUBSCRIPTIONS]:
        MonthRecord.#readRecurringCosts(monthData.subscriptions, RecurringCostList.SUBSCRIPTIONS),
    };
    // Fields this version doesn't know about (for example "importedFrom") are kept as they are.
    this.extraFields = MonthRecord.#unknownFields(monthData);
  }

  /** A month for a brand-new user: no budgets, no expenses. */
  static createEmpty(monthKey) {
    return new MonthRecord({
      month: monthKey,
      fixed: DEFAULT_FIXED_COST_NAMES.map((name) => ({ name, amount: 0 })),
    });
  }

  /** A new month that keeps the template's categories, budgets, expected income and recurring costs. */
  static createFromTemplate(templateRecord, monthKey) {
    const templateData = templateRecord.toJSON();
    return new MonthRecord({
      month: monthKey,
      income: { expected: templateData.income.expected, entries: [] },
      categories: templateData.categories,
      budgets: templateData.budgets,
      fixed: templateData.fixed,
      subscriptions: templateData.subscriptions,
    });
  }

  // ----- Expenses -----

  addExpense({ id, categoryId, amount, description, date }) {
    if (!(amount > 0) || this.findExpense(id)) return;
    this.expenses.push({ id, date, category: categoryId, description: description.trim(), amount: roundToCents(amount) });
  }

  removeExpense(expenseId) {
    this.expenses = this.expenses.filter((expense) => expense.id !== expenseId);
  }

  findExpense(expenseId) {
    return this.expenses.find((expense) => expense.id === expenseId);
  }

  updateExpenseAmount(expenseId, newAmount) {
    const expense = this.findExpense(expenseId);
    if (expense && newAmount > 0) expense.amount = roundToCents(newAmount);
  }

  /** Expenses in one category, newest first; undated (imported) expenses come last. */
  expensesInCategory(categoryId) {
    return MonthRecord.#newestFirst(this.expenses.filter((expense) => expense.category === categoryId));
  }

  spentInCategory(categoryId) {
    return sumAmounts(this.expensesInCategory(categoryId).map((expense) => expense.amount));
  }

  // ----- Income -----

  addIncome({ id, amount, description, date }) {
    if (!(amount > 0) || this.findIncome(id)) return;
    this.incomes.push({ id, date, description: description.trim(), amount: roundToCents(amount) });
  }

  removeIncome(incomeId) {
    this.incomes = this.incomes.filter((income) => income.id !== incomeId);
  }

  findIncome(incomeId) {
    return this.incomes.find((income) => income.id === incomeId);
  }

  updateIncomeAmount(incomeId, newAmount) {
    const income = this.findIncome(incomeId);
    if (income && newAmount > 0) income.amount = roundToCents(newAmount);
  }

  incomesNewestFirst() {
    return MonthRecord.#newestFirst(this.incomes);
  }

  get totalIncome() {
    return roundToCents(sumAmounts(this.incomes.map((income) => income.amount)));
  }

  setExpectedIncome(amount) {
    if (amount >= 0) this.expectedIncome = roundToCents(amount);
  }

  // ----- Categories and budgets -----

  findCategory(categoryId) {
    return this.categories.find((category) => category.id === categoryId);
  }

  /**
   * True when another category someone named already has this name, ignoring capitals and spaces.
   * @param {string} [exceptCategoryId]  the category being renamed, which may keep its own name
   */
  hasCategoryNamed(name, exceptCategoryId) {
    const wantedName = MonthRecord.normalizeCategoryName(name);
    return this.categories.some((category) => category.id !== exceptCategoryId && category.name !== undefined
      && MonthRecord.normalizeCategoryName(category.name) === wantedName);
  }

  /**
   * Gives a category the name someone typed. A renamed default category drops its translated
   * name, so it shows the typed name in every language. Renaming a category someone else
   * just removed does nothing.
   */
  renameCategory(categoryId, newName) {
    const category = this.findCategory(categoryId);
    if (!category) return;
    category.name = newName.trim();
    delete category.nameId;
  }

  /** "  Kids " and "KIDS" count as the same name. */
  static normalizeCategoryName(name) {
    return name.trim().toLocaleLowerCase();
  }

  /**
   * Adds a category at the end of the list, with a budget of 0. Adding an id that already
   * exists does nothing, so a resent change can't add two categories.
   * If two people add a category at the same moment, both may pick the same colour; the
   * second one then gets the next free colour instead.
   */
  addCategory({ id, name, color }) {
    if (this.findCategory(id) || this.categories.length >= MAX_CATEGORIES_PER_MONTH) return;
    const isColorTaken = this.categories.some((category) => category.color.toLowerCase() === color.toLowerCase());
    this.categories.push({ id, name: name.trim(), color: isColorTaken ? this.pickCategoryColor() : color });
    this.budgets[id] ??= 0;
  }

  /** Why a category can't be removed: 'has-expenses', 'last-category', or null when it can. */
  categoryRemovalBlocker(categoryId) {
    if (this.expenses.some((expense) => expense.category === categoryId)) return 'has-expenses';
    if (this.categories.length <= 1) return 'last-category';
    return null;
  }

  /** Removes an empty category and its budget. Removing one that is already gone does nothing. */
  removeCategory(categoryId) {
    this.categories = this.categories.filter((category) => category.id !== categoryId);
    delete this.budgets[categoryId];
  }

  /** The colour for a new category: the first palette colour this month doesn't use yet. */
  pickCategoryColor() {
    const usedColors = new Set(this.categories.map((category) => category.color.toLowerCase()));
    return CATEGORY_COLOR_PALETTE.find((color) => !usedColors.has(color))
      ?? CATEGORY_COLOR_PALETTE[this.categories.length % CATEGORY_COLOR_PALETTE.length];
  }

  budgetFor(categoryId) {
    return this.budgets[categoryId] ?? 0;
  }

  setBudget(categoryId, amount) {
    if (amount >= 0) this.budgets[categoryId] = roundToCents(amount);
  }

  // ----- Fixed costs and subscriptions -----

  /** @param {string} listName  one of RecurringCostList */
  recurringCostsIn(listName) {
    return this.recurringCosts[listName];
  }

  findRecurringCost(listName, costId) {
    return this.recurringCosts[listName].find((cost) => cost.id === costId);
  }

  addRecurringCost(listName, { id, name }) {
    if (this.findRecurringCost(listName, id)) return;
    this.recurringCosts[listName].push({ id, name: name.trim(), amount: 0 });
  }

  removeRecurringCost(listName, costId) {
    this.recurringCosts[listName] = this.recurringCosts[listName].filter((cost) => cost.id !== costId);
  }

  renameRecurringCost(listName, costId, newName) {
    const cost = this.findRecurringCost(listName, costId);
    if (cost && newName.trim()) cost.name = newName.trim();
  }

  setRecurringCostAmount(listName, costId, amount) {
    const cost = this.findRecurringCost(listName, costId);
    if (cost) cost.amount = amount >= 0 ? roundToCents(amount) : 0;
  }

  // ----- Totals (always calculated, never stored) -----

  calculateTotals() {
    const variableSpending = sumAmounts(this.expenses.map((expense) => expense.amount));
    const recurringCostsTotal = sumAmounts(Object.values(this.recurringCosts).flat().map((cost) => cost.amount));
    const categoryBudgetsTotal = sumAmounts(this.categories.map((category) => this.budgetFor(category.id)));
    const totalBudgeted = categoryBudgetsTotal + recurringCostsTotal;
    const totalSpent = variableSpending + recurringCostsTotal;
    const saved = this.totalIncome - totalSpent;

    return {
      variableSpending,
      recurringCostsTotal,
      totalSpent,
      totalBudgeted,
      saved,
      expectedSavings: this.expectedIncome - totalBudgeted,
      savingsRate: this.totalIncome > 0 ? saved / this.totalIncome : null,
    };
  }

  // ----- Saving -----

  /** The month in file format; JSON.stringify calls this automatically. */
  toJSON() {
    return {
      ...this.extraFields,
      month: this.monthKey,
      income: {
        expected: this.expectedIncome,
        actual: this.totalIncome,
        entries: this.incomes.map((income) => ({ ...income })),
      },
      categories: this.categories.map((category) => ({ ...category })),
      budgets: { ...this.budgets },
      expenses: this.expenses.map((expense) => ({ ...expense })),
      fixed: this.recurringCosts[RecurringCostList.FIXED_COSTS].map((cost) => ({ ...cost })),
      subscriptions: this.recurringCosts[RecurringCostList.SUBSCRIPTIONS].map((cost) => ({ ...cost })),
    };
  }

  // ----- Reading older files -----

  /**
   * Older files have one number, income.actual, instead of a list of entries. It becomes one
   * entry. Its id is derived from the month, so the browser and the server turn the same file
   * into the same entry and can both find it later.
   */
  static #readIncomeEntries(monthData) {
    const income = monthData.income ?? {};
    if (Array.isArray(income.entries)) return income.entries.map((entry) => ({ ...entry }));
    if (income.actual > 0) {
      return [{ id: `income-${monthData.month}-1`, date: null, description: '', amount: income.actual }];
    }
    return [];
  }

  /**
   * Older files have fixed costs without ids. Each gets an id from its list and position,
   * for example "fixed-1": the same on every device, and saved with the month from then on.
   */
  static #readRecurringCosts(costs, listName) {
    return (costs ?? []).map((cost, position) => ({ ...cost, id: cost.id ?? `${listName}-${position + 1}` }));
  }

  static #newestFirst(items) {
    return [...items].sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''));
  }

  /** Older files have no category list: they used the default categories. */
  static #readCategories(monthData) {
    const categories = Array.isArray(monthData.categories) ? monthData.categories : DEFAULT_CATEGORIES;
    return categories.map((category) => ({ ...category }));
  }

  static #zeroBudgets(categories) {
    return Object.fromEntries(categories.map((category) => [category.id, 0]));
  }

  static #unknownFields(monthData) {
    const knownFields = new Set(['month', 'income', 'categories', 'budgets', 'expenses', 'fixed', 'subscriptions']);
    return Object.fromEntries(Object.entries(monthData).filter(([fieldName]) => !knownFields.has(fieldName)));
  }
}
