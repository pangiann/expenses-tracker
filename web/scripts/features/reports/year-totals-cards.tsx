import type { YearSummary } from '../../../../shared/month/year-summary.ts';
import { Icon, type IconName } from '../../components/icons.tsx';
import { t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';
import { yearTotals } from './report-numbers.ts';

/** The year's Earned, Spent, Saved and Daily average, in the same cards as the month page. */
export function YearTotalsCards({ summary }: { summary: YearSummary }) {
  const totals = yearTotals(summary);
  return (
    <section className="summary-cards">
      <TotalCard
        icon="wallet"
        labelStringId="summary.earned"
        value={formatEuros(totals.earned)}
        detail={t('reports.monthsCounted', { count: summary.months.length })}
      />
      <TotalCard
        icon="shoppingBag"
        labelStringId="summary.spent"
        value={formatEuros(totals.spent)}
        detail={t('reports.fixedIncluded')}
      />
      <TotalCard
        icon="piggyBank"
        labelStringId="summary.saved"
        value={formatEuros(totals.saved)}
        valueClassName={totals.saved >= 0 ? 'is-positive' : 'is-negative'}
        detail={t('reports.earnedMinusSpent')}
      />
      <TotalCard
        icon="calendar"
        labelStringId="reports.dailyAverage"
        value={formatEuros(totals.dailyAverage)}
        detail={t('reports.dailyAverageDetail', { days: totals.daysCounted })}
      />
    </section>
  );
}

function TotalCard({
  icon,
  labelStringId,
  value,
  valueClassName = '',
  detail,
}: {
  icon: IconName;
  labelStringId: string;
  value: string;
  valueClassName?: string;
  detail: string;
}) {
  return (
    <div className="card summary-card">
      <div className="summary-card-label">
        {t(labelStringId)}
        <Icon name={icon} className={`summary-card-icon is-${icon}`} />
      </div>
      <div className={`summary-card-value ${valueClassName}`.trim()}>{value}</div>
      <div className="summary-card-detail">{detail}</div>
    </div>
  );
}
