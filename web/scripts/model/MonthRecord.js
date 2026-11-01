import { SPENDING_CATEGORIES, RecurringCostList, DEFAULT_FIXED_COST_NAMES } from '../config/categories.js';
import { roundToCents, sumAmounts } from '../utils/money.js';

/**
 * Everything recorded for one month: income, category budgets, expenses,
 * fixed costs and subscriptions.
 *
 * This class is the only place that changes month data. Views read from it and
 * call its methods; MonthRepository saves it with toJSON(), which produces exactly
 * the format of data/YYYY-MM.json:
 *
 *   {
 *     "month": "2026-09",
 *     "income": { "expected": 4000, "actual": 3500 },
 *     "budgets": { "dinner": 100, "lunch": 50, ... },
 *     "expenses": [ { "id": "...", "date": "2026-09-14", "category": "lunch",
 *                     "description": "coffee", "amount": 5.5 } ],
 *     "fixed": [ { "name": "Rent", "amount": 900 } ],
 *     "subscriptions": [ { "name": "Music", "amount": 10 } ]
 *   }
 */
export class MonthRecord {
  /** @param {object} monthData  the parsed contents of a month file */
  constructor(monthData) {
    this.monthKey = monthData.month;
    this.income = { expected: monthData.income?.expected ?? 0, actual: monthData.income?.actual ?? 0 };
    this.budgets = { ...MonthRecord.#zeroBudgets(), ...monthData.budgets };
    this.expenses = (monthData.expenses ?? []).map((expense) => ({ ...expense }));
    this.recurringCosts = {
      [RecurringCostList.FIXED_COSTS]: (monthData.fixed ?? []).map((cost) => ({ ...cost })),
      [RecurringCostList.SUBSCRIPTIONS]: (monthData.subscriptions ?? []).map((cost) => ({ ...cost })),
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

  /** A new month that keeps the template's budgets, expected income and recurring costs, without expenses. */
  static createFromTemplate(templateRecord, monthKey) {
    const templateData = templateRecord.toJSON();
    return new MonthRecord({
      month: monthKey,
      income: { expected: templateData.income.expected, actual: 0 },
      budgets: templateData.budgets,
      fixed: templateData.fixed,
      subscriptions: templateData.subscriptions,
    });
  }

  // ----- Expenses -----

  /**
   * Adds an expense. The id is created by the device that adds it (createUniqueId),
   * so a change that is sent twice after a reconnect adds the expense only once.
   */
  addExpense({ id, categoryKey, amount, description, date }) {
    if (!(amount > 0) || this.findExpense(id)) return;
    this.expenses.push({
      id,
      date,
      category: categoryKey,
      description: description.trim(),
      amount: roundToCents(amount),
    });
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
  expensesInCategory(categoryKey) {
    return this.expenses
      .filter((expense) => expense.category === categoryKey)
      .sort((first, second) => (second.date ?? '').localeCompare(first.date ?? ''));
  }

  spentInCategory(categoryKey) {
    return sumAmounts(this.expensesInCategory(categoryKey).map((expense) => expense.amount));
  }

  // ----- Budgets and income -----

  budgetFor(categoryKey) {
    return this.budgets[categoryKey] ?? 0;
  }

  setBudget(categoryKey, amount) {
    if (amount >= 0) this.budgets[categoryKey] = roundToCents(amount);
  }

  setActualIncome(amount) {
    this.income.actual = amount >= 0 ? roundToCents(amount) : 0;
  }

  setExpectedIncome(amount) {
    if (amount >= 0) this.income.expected = roundToCents(amount);
  }

  // ----- Fixed costs and subscriptions -----

  /** @param {string} listName  one of RecurringCostList */
  recurringCostsIn(listName) {
    return this.recurringCosts[listName];
  }

  addRecurringCost(listName) {
    this.recurringCosts[listName].push({ name: 'New item', amount: 0 });
  }

  removeRecurringCost(listName, position) {
    this.recurringCosts[listName].splice(position, 1);
  }

  renameRecurringCost(listName, position, newName) {
    const trimmedName = newName.trim();
    if (trimmedName) this.recurringCosts[listName][position].name = trimmedName;
  }

  setRecurringCostAmount(listName, position, amount) {
    this.recurringCosts[listName][position].amount = amount >= 0 ? roundToCents(amount) : 0;
  }

  // ----- Totals (always calculated, never stored) -----

  calculateTotals() {
    const variableSpending = sumAmounts(this.expenses.map((expense) => expense.amount));
    const recurringCostsTotal = sumAmounts(
      Object.values(this.recurringCosts).flat().map((cost) => cost.amount));
    const categoryBudgetsTotal = sumAmounts(Object.values(this.budgets));
    const totalSpent = variableSpending + recurringCostsTotal;
    const saved = this.income.actual - totalSpent;

    return {
      variableSpending,
      recurringCostsTotal,
      totalSpent,
      totalBudgeted: categoryBudgetsTotal + recurringCostsTotal,
      saved,
      expectedSavings: this.income.expected - (categoryBudgetsTotal + recurringCostsTotal),
      savingsRate: this.income.actual > 0 ? saved / this.income.actual : null,
    };
  }

  // ----- Saving -----

  /** The month in file format; JSON.stringify calls this automatically. */
  toJSON() {
    return {
      ...this.extraFields,
      month: this.monthKey,
      income: { ...this.income },
      budgets: { ...this.budgets },
      expenses: this.expenses.map((expense) => ({ ...expense })),
      fixed: this.recurringCosts[RecurringCostList.FIXED_COSTS].map((cost) => ({ ...cost })),
      subscriptions: this.recurringCosts[RecurringCostList.SUBSCRIPTIONS].map((cost) => ({ ...cost })),
    };
  }

  // ----- Private helpers -----

  static #zeroBudgets() {
    return Object.fromEntries(SPENDING_CATEGORIES.map((category) => [category.key, 0]));
  }

  static #unknownFields(monthData) {
    const knownFields = new Set(['month', 'income', 'budgets', 'expenses', 'fixed', 'subscriptions']);
    return Object.fromEntries(Object.entries(monthData).filter(([fieldName]) => !knownFields.has(fieldName)));
  }
}
