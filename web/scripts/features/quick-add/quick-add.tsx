import { useRef, useState } from 'react';

import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import { categoryName, t } from '../../i18n/translator.ts';
import { parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate, monthDateRange } from '../../utils/month-keys.ts';

/**
 * The "Add expense" bar: amount, description, category, date. Submitting adds the expense
 * (POST /api/months/:month/expenses), the same as the form in a category card.
 */
export function QuickAdd({ month }: { month: MonthRecord }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [chosenCategoryId, setChosenCategoryId] = useState('');
  /** The date someone picked, for the month it was picked in; another month starts from its default date. */
  const [pickedDate, setPickedDate] = useState({ monthKey: '', date: '' });
  const amountInput = useRef<HTMLInputElement>(null);

  // The chosen category stays selected while it exists in the month; otherwise the first one.
  const categoryId = month.findCategory(chosenCategoryId) ? chosenCategoryId : (month.categories[0]?.id ?? '');
  const date = pickedDate.monthKey === month.monthKey ? pickedDate.date : defaultExpenseDate(month.monthKey);
  const { firstDay, lastDay } = monthDateRange(month.monthKey);

  return (
    <section className="card quick-add">
      <h2>{t('quickAdd.title')}</h2>
      <form
        className="quick-add-form"
        autoComplete="off"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const isSent = expensesApi.addExpense(month.monthKey, {
            categoryId,
            amount: parseAmount(amount) ?? 0,
            description,
            date: date || defaultExpenseDate(month.monthKey),
          });
          if (!isSent) return; // for example no amount: keep what was typed
          setAmount('');
          setDescription('');
          amountInput.current?.focus();
        }}
      >
        <input
          ref={amountInput}
          type="number"
          step="0.01"
          min="0"
          placeholder={t('common.amountPlaceholder')}
          required
          value={amount}
          onChange={(changeEvent) => setAmount(changeEvent.target.value)}
        />
        <input
          type="text"
          placeholder={t('common.descriptionPlaceholder')}
          value={description}
          onChange={(changeEvent) => setDescription(changeEvent.target.value)}
        />
        <select required value={categoryId} onChange={(changeEvent) => setChosenCategoryId(changeEvent.target.value)}>
          {month.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryName(category)}
            </option>
          ))}
        </select>
        <input
          type="date"
          min={firstDay}
          max={lastDay}
          value={date}
          onChange={(changeEvent) => setPickedDate({ monthKey: month.monthKey, date: changeEvent.target.value })}
        />
        <button type="submit" className="primary-button">
          {t('common.add')}
        </button>
      </form>
    </section>
  );
}
