import type { ReactNode } from 'react';

import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as incomeApi from '../../api/income-api.ts';
import { EditableAmount } from '../../components/editable-amount.tsx';
import { Icon, type IconName } from '../../components/icons.tsx';
import { t } from '../../i18n/translator.ts';
import { formatEuros, formatPercent } from '../../utils/money.ts';

/**
 * Earned, Spent, Saved and Savings rate cards. Earned is the sum of the Income card's
 * entries. Clicking the expected income edits it (PUT /api/months/:month/expected-income).
 */
export function SummaryCards({ month }: { month: MonthRecord }) {
  const totals = month.calculateTotals();
  return (
    <section className="summary-cards">
      <SummaryCard
        icon="wallet"
        labelStringId="summary.earned"
        value={formatEuros(month.totalIncome)}
        detailStringId="summary.expected"
        detail={
          <EditableAmount
            amount={month.expectedIncome}
            allowZero
            onSave={(newAmount) => incomeApi.changeExpectedIncome(month.monthKey, newAmount)}
          />
        }
      />
      <SummaryCard
        icon="shoppingBag"
        labelStringId="summary.spent"
        value={formatEuros(totals.totalSpent)}
        valueClassName={totals.totalSpent > totals.totalBudgeted ? 'is-negative' : ''}
        detailStringId="summary.budgeted"
        detail={formatEuros(totals.totalBudgeted)}
      />
      <SummaryCard
        icon="piggyBank"
        labelStringId="summary.saved"
        value={formatEuros(totals.saved)}
        valueClassName={totals.saved >= 0 ? 'is-positive' : 'is-negative'}
        detailStringId="summary.expected"
        detail={formatEuros(totals.expectedSavings)}
      />
      <SummaryCard
        icon="percent"
        labelStringId="summary.savingsRate"
        value={totals.savingsRate === null ? '–' : formatPercent(totals.savingsRate)}
        detailStringId="summary.variableSpending"
        detail={formatEuros(totals.variableSpending)}
      />
    </section>
  );
}

function SummaryCard({
  icon,
  labelStringId,
  value,
  valueClassName = '',
  detailStringId,
  detail,
}: {
  /** a small icon in the card's corner, colored by the card (summary-cards.css) */
  icon: IconName;
  labelStringId: string;
  value: string;
  valueClassName?: string;
  detailStringId: string;
  detail: ReactNode;
}) {
  return (
    <div className="card summary-card">
      <div className="summary-card-label">
        {t(labelStringId)}
        <Icon name={icon} className={`summary-card-icon is-${icon}`} />
      </div>
      <div className={`summary-card-value ${valueClassName}`.trim()}>{value}</div>
      <div className="summary-card-detail">
        <span>{t(detailStringId)}</span> <span>{detail}</span>
      </div>
    </div>
  );
}
