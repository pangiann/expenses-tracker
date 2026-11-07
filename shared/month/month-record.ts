import {
  CATEGORY_COLOR_PALETTE,
  DEFAULT_CATEGORIES,
  DEFAULT_FIXED_COST_NAMES,
  MAX_CATEGORIES_PER_MONTH,
  MAX_CATEGORY_NAME_LENGTH,
  RecurringCostList,
  type Category,
  type RecurringCostListName,
} from './categories.ts';
import { roundToCents, sumAmounts } from './amounts.ts';

export interface Expense {
  id: string;
  /** "YYYY-MM-DD"; missing on some expenses imported from the old spreadsheet */
  date?: string | null;
  /** the category's id */
  category: string;
  description: string;
  amount: number;
}

export interface IncomeEntry {
  id: string;
  date?: string | null;
  description: string;
  amount: number;
}

/** A fixed cost or a subscription. */
export interface RecurringCost {
  id: string;
  name: string;
  amount: number;
}

/** A month as saved: what toJSON() returns and what the Worker stores. */
export interface MonthData {
  month: string;
  income: { expected: number; actual: number; entries: IncomeEntry[] };
  categories: Category[];
  budgets: Record<string, number>;
  expenses: Expense[];
  fixed: RecurringCost[];
  subscriptions: RecurringCost[];
  /** Fields this version doesn't know about are kept as they are. */
  [extraField: string]: unknown;
}

/**
 * A month as it may arrive from an older file or an import: everything except the month key
 * is optional, income may be a single number, and fixed costs may lack ids.
 */
export interface StoredMonthData {
  month: string;
  income?: { expected?: number; actual?: number; entries?: IncomeEntry[] };
  categories?: Category[];
  budgets?: Record<string, number>;
  expenses?: Expense[];
  fixed?: StoredRecurringCost[];
  subscriptions?: StoredRecurringCost[];
  [extraField: string]: unknown;
}

type StoredRecurringCost = Omit<RecurringCost, 'id'> & { id?: string };

export interface MonthTotals {
  variableSpending: number;
  recurringCostsTotal: number;
  totalSpent: number;
  totalBudgeted: number;
  saved: number;
  expectedSavings: number;
  /** saved / income, or null without income */
  savingsRate: number | null;
}

/** Why a category can't be removed. */
export type CategoryRemovalBlocker = 'has-expenses' | 'last-category';

/** Every rule of a month that an edit can break. The page shows a message for each. */
export type MonthRule =
  | 'unknown-category'
  | 'date-outside-month'
  | 'category-name-empty'
  | 'category-name-too-long'
  | 'category-name-taken'
  | 'too-many-categories'
  | 'category-has-expenses'
  | 'last-category';

/** An edit that breaks a rule of the month, for example an expense in a category that doesn't exist. */
export class MonthRuleError extends Error {
  constructor(readonly rule: MonthRule) {
    super(`Month rule broken: ${rule}`);
  }
}

const KNOWN_FIELDS = new Set(['month', 'income', 'categories', 'budgets', 'expenses', 'fixed', 'subscriptions']);

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
 * that no longer exists does nothing, so applying the same edit twice is harmless.
 *
 * Methods throw MonthRuleError when an edit breaks a rule that depends on the month, such as
 * an expense dated outside it. Callers check the shape of what they pass (types, lengths,
 * amounts) before calling.
 */
export class MonthRecord {
  readonly monthKey: string;
  expectedIncome: number;
  incomes: IncomeEntry[];
  categories: Category[];
  budgets: Record<string, number>;
  expenses: Expense[];
  recurringCosts: Record<RecurringCostListName, RecurringCost[]>;
  /** Fields this version doesn't know about (for example "importedFrom"), kept as they are. */
  private readonly fieldsThisCodeDoesNotKnow: Record<string, unknown>;

  /** @param monthData  the parsed contents of a month file */
  constructor(monthData: StoredMonthData) {
    this.monthKey = monthData.month;
    this.expectedIncome = monthData.income?.expected ?? 0;
    this.incomes = MonthRecord.#readIncomeEntries(monthData);
    this.categories = MonthRecord.#readCategories(monthData);
    this.budgets = { ...MonthRecord.#zeroBudgetForEachCategory(this.categories), ...monthData.budgets };
    this.expenses = (monthData.expenses ?? []).map((expense) => ({ ...expense }));
    this.recurringCosts = {
      [RecurringCostList.FIXED_COSTS]: MonthRecord.#readRecurringCosts(monthData.fixed, RecurringCostList.FIXED_COSTS),
      [RecurringCostList.SUBSCRIPTIONS]: MonthRecord.#readRecurringCosts(
        monthData.subscriptions,
        RecurringCostList.SUBSCRIPTIONS,
      ),
    };
    this.fieldsThisCodeDoesNotKnow = MonthRecord.#readFieldsThisCodeDoesNotKnow(monthData);
  }

  /** A month for a brand-new user: no budgets, no expenses. */
  static createEmptyMonth(monthKey: string): MonthRecord {
    return new MonthRecord({
      month: monthKey,
      fixed: DEFAULT_FIXED_COST_NAMES.map((name) => ({ name, amount: 0 })),
    });
  }

  /** A new month that keeps the template's categories, budgets, expected income and recurring costs. */
  static createFromTemplateMonth(templateRecord: MonthRecord, monthKey: string): MonthRecord {
    const templateMonthData = templateRecord.toJSON();
    return new MonthRecord({
      month: monthKey,
      income: { expected: templateMonthData.income.expected, entries: [] },
      categories: templateMonthData.categories,
      budgets: templateMonthData.budgets,
      fixed: templateMonthData.fixed,
      subscriptions: templateMonthData.subscriptions,
    });
  }

  // ----- Expenses -----

  addExpense({
    id,
    categoryId,
    amount,
    description,
    date,
  }: {
    id: string;
    categoryId: string;
    amount: number;
    description: string;
    date: string;
  }): void {
    if (!(amount > 0) || this.findExpense(id)) return;
    this.#requireCategory(categoryId);
    this.#requireDateInMonth(date);
    this.expenses.push({
      id,
      date,
      category: categoryId,
      description: description.trim(),
      amount: roundToCents(amount),
    });
  }

  removeExpense(expenseId: string): void {
    this.expenses = this.expenses.filter((expense) => expense.id !== expenseId);
  }

  findExpense(expenseId: string): Expense | undefined {
    return this.expenses.find((expense) => expense.id === expenseId);
  }

  updateExpenseAmount(expenseId: string, newAmount: number): void {
    const expense = this.findExpense(expenseId);
    if (expense && newAmount > 0) expense.amount = roundToCents(newAmount);
  }

  /** Expenses in one category, newest first; undated (imported) expenses come last. */
  expensesInCategory(categoryId: string): Expense[] {
    return MonthRecord.#sortNewestFirst(this.expenses.filter((expense) => expense.category === categoryId));
  }

  spentInCategory(categoryId: string): number {
    return sumAmounts(this.expensesInCategory(categoryId).map((expense) => expense.amount));
  }

  // ----- Income -----

  addIncome({
    id,
    amount,
    description,
    date,
  }: {
    id: string;
    amount: number;
    description: string;
    date: string;
  }): void {
    if (!(amount > 0) || this.findIncome(id)) return;
    this.#requireDateInMonth(date);
    this.incomes.push({ id, date, description: description.trim(), amount: roundToCents(amount) });
  }

  removeIncome(incomeId: string): void {
    this.incomes = this.incomes.filter((income) => income.id !== incomeId);
  }

  findIncome(incomeId: string): IncomeEntry | undefined {
    return this.incomes.find((income) => income.id === incomeId);
  }

  updateIncomeAmount(incomeId: string, newAmount: number): void {
    const income = this.findIncome(incomeId);
    if (income && newAmount > 0) income.amount = roundToCents(newAmount);
  }

  incomesNewestFirst(): IncomeEntry[] {
    return MonthRecord.#sortNewestFirst(this.incomes);
  }

  get totalIncome(): number {
    return roundToCents(sumAmounts(this.incomes.map((income) => income.amount)));
  }

  setExpectedIncome(amount: number): void {
    if (amount >= 0) this.expectedIncome = roundToCents(amount);
  }

  // ----- Categories and budgets -----

  findCategory(categoryId: string): Category | undefined {
    return this.categories.find((category) => category.id === categoryId);
  }

  /**
   * True when another category someone named already has this name, ignoring capitals and spaces.
   * @param exceptCategoryId  the category being renamed, which may keep its own name
   */
  hasCategoryNamed(name: string, exceptCategoryId?: string): boolean {
    const normalizedWantedName = MonthRecord.normalizeCategoryName(name);
    return this.categories.some(
      (category) =>
        category.id !== exceptCategoryId &&
        category.name !== undefined &&
        MonthRecord.normalizeCategoryName(category.name) === normalizedWantedName,
    );
  }

  /**
   * Gives a category the name someone typed. A renamed default category drops its translated
   * name, so it shows the typed name in every language. Renaming a category someone else
   * just removed does nothing.
   */
  renameCategory(categoryId: string, newName: string): void {
    const category = this.findCategory(categoryId);
    if (!category) return;
    category.name = this.#requireFreeCategoryName(newName, categoryId);
    delete category.nameId;
  }

  /** "  Kids " and "KIDS" count as the same name. */
  static normalizeCategoryName(name: string): string {
    return name.trim().toLocaleLowerCase();
  }

  /**
   * Adds a category at the end of the list, with a budget of 0. Adding an id that already
   * exists does nothing, so a resent change can't add two categories.
   * If two people add a category at the same moment, both may pick the same colour; the
   * second one then gets the next free colour instead.
   */
  addCategory({ id, name, color }: { id: string; name: string; color: string }): void {
    if (this.findCategory(id)) return; // already added (the same edit sent twice)
    if (this.categories.length >= MAX_CATEGORIES_PER_MONTH) throw new MonthRuleError('too-many-categories');
    const uniqueCategoryName = this.#requireFreeCategoryName(name);
    const isColorTaken = this.categories.some((category) => category.color.toLowerCase() === color.toLowerCase());
    this.categories.push({ id, name: uniqueCategoryName, color: isColorTaken ? this.pickCategoryColor() : color });
    this.budgets[id] ??= 0;
  }

  /** Why a category can't be removed, or null when it can. */
  categoryRemovalBlocker(categoryId: string): CategoryRemovalBlocker | null {
    if (this.expenses.some((expense) => expense.category === categoryId)) return 'has-expenses';
    if (this.categories.length <= 1) return 'last-category';
    return null;
  }

  /**
   * Removes an empty category and its budget. Removing one that is already gone does nothing.
   * Someone may have added an expense to it meanwhile; then it stays.
   */
  removeCategory(categoryId: string): void {
    if (!this.findCategory(categoryId)) return;
    const removalBlocker = this.categoryRemovalBlocker(categoryId);
    if (removalBlocker)
      throw new MonthRuleError(removalBlocker === 'has-expenses' ? 'category-has-expenses' : 'last-category');
    this.categories = this.categories.filter((category) => category.id !== categoryId);
    delete this.budgets[categoryId];
  }

  /**
   * Moves a category so it sits just before another one, or last when beforeCategoryId is null
   * or no longer exists. Saying "before X" instead of "to position 3" keeps the intended order
   * when someone else moves, adds or removes categories at the same moment.
   */
  moveCategory(categoryId: string, beforeCategoryId: string | null): void {
    const movedCategory = this.findCategory(categoryId);
    if (!movedCategory || categoryId === beforeCategoryId) return;
    const remainingCategories = this.categories.filter((category) => category.id !== categoryId);
    const targetPosition = remainingCategories.findIndex((category) => category.id === beforeCategoryId);
    remainingCategories.splice(targetPosition < 0 ? remainingCategories.length : targetPosition, 0, movedCategory);
    this.categories = remainingCategories;
  }

  /** The colour for a new category: the first palette colour this month doesn't use yet. */
  pickCategoryColor(): string {
    const usedColors = new Set(this.categories.map((category) => category.color.toLowerCase()));
    return (
      CATEGORY_COLOR_PALETTE.find((color) => !usedColors.has(color)) ??
      // The palette is never empty, so this index always exists.
      CATEGORY_COLOR_PALETTE[this.categories.length % CATEGORY_COLOR_PALETTE.length]!
    );
  }

  budgetFor(categoryId: string): number {
    return this.budgets[categoryId] ?? 0;
  }

  setBudget(categoryId: string, amount: number): void {
    this.#requireCategory(categoryId);
    if (amount >= 0) this.budgets[categoryId] = roundToCents(amount);
  }

  // ----- Fixed costs and subscriptions -----

  recurringCostsIn(listName: RecurringCostListName): RecurringCost[] {
    return this.recurringCosts[listName];
  }

  findRecurringCost(listName: RecurringCostListName, costId: string): RecurringCost | undefined {
    return this.recurringCosts[listName].find((cost) => cost.id === costId);
  }

  addRecurringCost(listName: RecurringCostListName, { id, name }: { id: string; name: string }): void {
    if (this.findRecurringCost(listName, id)) return;
    this.recurringCosts[listName].push({ id, name: name.trim(), amount: 0 });
  }

  removeRecurringCost(listName: RecurringCostListName, costId: string): void {
    this.recurringCosts[listName] = this.recurringCosts[listName].filter((cost) => cost.id !== costId);
  }

  renameRecurringCost(listName: RecurringCostListName, costId: string, newName: string): void {
    const cost = this.findRecurringCost(listName, costId);
    if (cost && newName.trim()) cost.name = newName.trim();
  }

  setRecurringCostAmount(listName: RecurringCostListName, costId: string, amount: number): void {
    const cost = this.findRecurringCost(listName, costId);
    if (cost) cost.amount = amount >= 0 ? roundToCents(amount) : 0;
  }

  // ----- Totals (always calculated, never stored) -----

  calculateTotals(): MonthTotals {
    const variableSpending = sumAmounts(this.expenses.map((expense) => expense.amount));
    const recurringCostsTotal = sumAmounts(
      Object.values(this.recurringCosts)
        .flat()
        .map((cost) => cost.amount),
    );
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
  toJSON(): MonthData {
    return {
      ...this.fieldsThisCodeDoesNotKnow,
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

  // ----- Rules -----

  /** Each month has its own list of categories. */
  #requireCategory(categoryId: string): void {
    if (!this.findCategory(categoryId)) throw new MonthRuleError('unknown-category');
  }

  /** "YYYY-MM-DD" within this month. */
  #requireDateInMonth(date: string): void {
    if (!date.startsWith(`${this.monthKey}-`)) throw new MonthRuleError('date-outside-month');
  }

  /**
   * A category name: not empty, at most MAX_CATEGORY_NAME_LENGTH characters, and different
   * from the month's other names, ignoring capitals and surrounding spaces. The server only
   * knows the names people typed; the page also compares with the translated default names.
   * @returns the name without surrounding spaces
   */
  #requireFreeCategoryName(name: string, renamedCategoryId?: string): string {
    const trimmedName = name.trim();
    if (trimmedName === '') throw new MonthRuleError('category-name-empty');
    if (trimmedName.length > MAX_CATEGORY_NAME_LENGTH) throw new MonthRuleError('category-name-too-long');
    if (this.hasCategoryNamed(trimmedName, renamedCategoryId)) throw new MonthRuleError('category-name-taken');
    return trimmedName;
  }

  // ----- Reading older files -----

  /**
   * Older files have one number, income.actual, instead of a list of entries. It becomes one
   * entry. Its id is derived from the month, so the browser and the server turn the same file
   * into the same entry and can both find it later.
   */
  static #readIncomeEntries(monthData: StoredMonthData): IncomeEntry[] {
    const income = monthData.income ?? {};
    if (Array.isArray(income.entries)) return income.entries.map((entry) => ({ ...entry }));
    if (income.actual !== undefined && income.actual > 0) {
      return [{ id: `income-${monthData.month}-1`, date: null, description: '', amount: income.actual }];
    }
    return [];
  }

  /**
   * Older files have fixed costs without ids. Each gets an id from its list and position,
   * for example "fixed-1": the same on every device, and saved with the month from then on.
   */
  static #readRecurringCosts(
    costs: StoredRecurringCost[] | undefined,
    listName: RecurringCostListName,
  ): RecurringCost[] {
    return (costs ?? []).map((cost, position) => ({ ...cost, id: cost.id ?? `${listName}-${position + 1}` }));
  }

  static #sortNewestFirst<Item extends { date?: string | null }>(items: Item[]): Item[] {
    return [...items].sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''));
  }

  /** Older files have no category list: they used the default categories. */
  static #readCategories(monthData: StoredMonthData): Category[] {
    const categories = Array.isArray(monthData.categories) ? monthData.categories : DEFAULT_CATEGORIES;
    return categories.map((category) => ({ ...category }));
  }

  static #zeroBudgetForEachCategory(categories: Category[]): Record<string, number> {
    return Object.fromEntries(categories.map((category) => [category.id, 0]));
  }

  static #readFieldsThisCodeDoesNotKnow(monthData: StoredMonthData): Record<string, unknown> {
    return Object.fromEntries(Object.entries(monthData).filter(([fieldName]) => !KNOWN_FIELDS.has(fieldName)));
  }
}
