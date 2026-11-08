// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.ts';
import * as categoriesApi from '../web/scripts/api/categories-api.ts';
import * as expensesApi from '../web/scripts/api/expenses-api.ts';
import * as incomeApi from '../web/scripts/api/income-api.ts';
import * as recurringCostsApi from '../web/scripts/api/recurring-costs-api.ts';
import { AmountInput } from '../web/scripts/components/amount-input.tsx';
import { EditableAmount } from '../web/scripts/components/editable-amount.tsx';
import { CategoryCardsGrid } from '../web/scripts/features/categories/category-cards-grid.tsx';
import { QuickAdd } from '../web/scripts/features/quick-add/quick-add.tsx';
import { UNDO_TIME_MS, UndoToast } from '../web/scripts/features/undo/undo-toast.tsx';

// The API functions send requests; the tests only check that the screen calls the right one.
vi.mock('../web/scripts/api/expenses-api.ts', () => ({
  addExpense: vi.fn(() => true),
  changeExpenseAmount: vi.fn(() => true),
  removeExpense: vi.fn(() => true),
  restoreExpense: vi.fn(() => true),
}));
vi.mock('../web/scripts/api/income-api.ts', () => ({
  restoreIncome: vi.fn(() => true),
}));
vi.mock('../web/scripts/api/recurring-costs-api.ts', () => ({
  restoreRecurringCost: vi.fn(() => true),
}));
vi.mock('../web/scripts/api/categories-api.ts', () => ({
  addCategory: vi.fn(() => true),
  renameCategory: vi.fn(() => true),
  moveCategory: vi.fn(() => true),
  changeBudget: vi.fn(() => true),
  removeCategory: vi.fn(() => true),
}));

const november = () => {
  const month = MonthRecord.createEmptyMonth('2026-11');
  month.addExpense({ id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' });
  return month;
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

test('quick add sends the expense and clears the amount', () => {
  const { container } = render(<QuickAdd month={november()} />);
  const amountInput = container.querySelector<HTMLInputElement>('input[type=number]')!;
  fireEvent.change(amountInput, { target: { value: '12.5' } });
  fireEvent.change(container.querySelector('input[type=text]')!, { target: { value: 'pizza' } });
  fireEvent.change(container.querySelector('select')!, { target: { value: 'dinner' } });
  fireEvent.submit(container.querySelector('form')!);

  expect(expensesApi.addExpense).toHaveBeenCalledTimes(1);
  const [monthKey, expense] = vi.mocked(expensesApi.addExpense).mock.calls[0]!;
  expect(monthKey).toBe('2026-11');
  expect(expense).toMatchObject({ categoryId: 'dinner', amount: 12.5, description: 'pizza' });
  expect(expense.date).toMatch(/^2026-11-\d\d$/);
  expect(amountInput.value).toBe('');
});

test('an amount saves once on Enter, and Escape keeps the old amount', () => {
  const onSave = vi.fn();
  const { container } = render(<EditableAmount amount={10} onSave={onSave} />);

  fireEvent.click(container.querySelector('.click-to-edit')!);
  const input = container.querySelector('input')!;
  fireEvent.change(input, { target: { value: '12' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith(12);

  fireEvent.click(container.querySelector('.click-to-edit')!);
  fireEvent.change(container.querySelector('input')!, { target: { value: '99' } });
  fireEvent.keyDown(container.querySelector('input')!, { key: 'Escape' });
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(container.querySelector('input')).toBeNull();
});

test('a category with expenses explains why it cannot be removed; an empty one asks first', () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  const { container } = render(<CategoryCardsGrid month={november()} />);
  const removeButtonOf = (name: string) =>
    [...container.querySelectorAll('.category-card')]
      .find((card) => card.querySelector('.category-name')?.textContent === name)!
      .querySelector<HTMLButtonElement>('.category-remove-button')!;

  // Without loaded translations, names show their string ids.
  fireEvent.click(removeButtonOf('category.lunch'));
  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(categoriesApi.removeCategory).not.toHaveBeenCalled();

  fireEvent.click(removeButtonOf('category.travel'));
  expect(confirmSpy).toHaveBeenCalledTimes(1);
  expect(categoriesApi.removeCategory).toHaveBeenCalledWith('2026-11', 'travel');
});

test('removing an expense from a card calls its endpoint', () => {
  render(<CategoryCardsGrid month={november()} />);
  fireEvent.click(screen.getByTitle('common.delete'));
  expect(expensesApi.removeExpense).toHaveBeenCalledWith('2026-11', 'e1');
});

test('amount fields ignore the keys browsers allow in numbers but amounts never use', () => {
  const onKeyDown = vi.fn();
  const { container } = render(<AmountInput onKeyDown={onKeyDown} />);
  const input = container.querySelector('input')!;
  for (const key of ['e', 'E', '+', '-']) expect(fireEvent.keyDown(input, { key })).toBe(false); // the key did nothing
  for (const key of ['1', '.', ',', 'Enter']) expect(fireEvent.keyDown(input, { key })).toBe(true);
  expect(onKeyDown).toHaveBeenCalledTimes(4); // only the allowed keys reach the field's own handler
  expect(input.inputMode).toBe('decimal'); // phones show the number pad
});

test('the undo toast adds the removed expense back, and goes away after a few seconds', () => {
  vi.useFakeTimers();
  const expense = { id: 'e1', category: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
  const onDismiss = vi.fn();
  const { rerender } = render(
    <UndoToast removedItem={{ kind: 'expense', monthKey: '2026-11', expense }} onDismiss={onDismiss} />,
  );
  fireEvent.click(screen.getByText('undo.undo'));
  expect(expensesApi.restoreExpense).toHaveBeenCalledWith('2026-11', expense);

  vi.advanceTimersByTime(UNDO_TIME_MS);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  rerender(<UndoToast removedItem={null} onDismiss={onDismiss} />);
  expect(screen.queryByText('undo.undo')).toBeNull();
  vi.useRealTimers();
});

test('the undo toast adds a removed fixed cost back', () => {
  const cost = { id: 'fixed-1', name: 'Rent', amount: 900 };
  render(
    <UndoToast removedItem={{ kind: 'recurringCost', monthKey: '2026-11', list: 'fixed', cost }} onDismiss={vi.fn()} />,
  );
  fireEvent.click(screen.getByText('undo.undo'));
  expect(recurringCostsApi.restoreRecurringCost).toHaveBeenCalledWith('2026-11', 'fixed', cost);
});

test('the undo toast adds a removed income entry back', () => {
  const income = { id: 'salary', amount: 3200, description: 'salary', date: '2026-11-01' };
  render(<UndoToast removedItem={{ kind: 'income', monthKey: '2026-11', income }} onDismiss={vi.fn()} />);
  expect(screen.getByText('undo.incomeRemoved')).toBeTruthy();
  fireEvent.click(screen.getByText('undo.undo'));
  expect(incomeApi.restoreIncome).toHaveBeenCalledWith('2026-11', income);
});
