import { useRef, useState } from 'react';

import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as incomeApi from '../../api/income-api.ts';
import { EntryRows } from '../../components/entry-rows.tsx';
import { t } from '../../i18n/translator.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate } from '../../utils/month-keys.ts';
import { AmountInput } from '../../components/amount-input.tsx';
import { Icon } from '../../components/icons.tsx';

/**
 * The Income card: every amount earned this month (salary, each private lesson, ...), with
 * the total at the top. It works like a category card: add with the form at the bottom,
 * click an amount to change it, ✕ to remove it. Each calls one income endpoint.
 */
export function IncomeCard({ month }: { month: MonthRecord }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const amountInput = useRef<HTMLInputElement>(null);

  return (
    <section className="card category-card income-card">
      <div className="category-card-header income-card-header">
        <div className="category-card-title">
          <h2 className="income-card-heading">
            <Icon name="banknote" className="card-title-icon" />
            {t('income.title')}
          </h2>
          <span className="category-card-spent">{formatEuros(month.totalIncome)}</span>
        </div>
      </div>
      <ul className="expense-list">
        <EntryRows
          entries={month.incomesNewestFirst()}
          untitledStringId="income.untitled"
          onChangeAmount={(incomeId, newAmount) => incomeApi.changeIncomeAmount(month.monthKey, incomeId, newAmount)}
          onRemove={(incomeId) => incomeApi.removeIncome(month.monthKey, incomeId)}
        />
      </ul>
      <form
        className="category-add-form"
        autoComplete="off"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const wasEditRecorded = incomeApi.addIncome(month.monthKey, {
            amount: parseAmount(amount) ?? 0,
            description,
            date: defaultExpenseDate(month.monthKey),
          });
          if (!wasEditRecorded) return;
          setDescription('');
          setAmount('');
          amountInput.current?.focus();
        }}
      >
        <input
          name="description"
          placeholder={t('income.descriptionPlaceholder')}
          value={description}
          onChange={(changeEvent) => setDescription(changeEvent.target.value)}
        />
        <AmountInput
          ref={amountInput}
          name="amount"
          placeholder="€"
          required
          value={amount}
          onChange={(changeEvent) => setAmount(changeEvent.target.value)}
        />
        <button type="submit" title={t('common.add')}>
          +
        </button>
      </form>
    </section>
  );
}
