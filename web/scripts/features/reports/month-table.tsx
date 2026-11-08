import type { YearSummary } from '../../../../shared/month/year-summary.ts';
import { CardTitle } from '../../components/card-title.tsx';
import { t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';
import { formatMonthTitle } from '../../utils/month-keys.ts';
import { monthDailyAverage } from './report-numbers.ts';

/** Every saved month of the year in one row, newest first. A row opens its month. */
export function MonthTable({
  summary,
  onOpenMonth,
}: {
  summary: YearSummary;
  onOpenMonth: (monthKey: string) => void;
}) {
  const newestFirst = [...summary.months].reverse();
  return (
    <div className="card">
      <CardTitle icon="calendar" titleStringId="reports.monthsTitle" descriptionStringId="reports.monthsDescription" />
      <table className="month-table">
        <thead>
          <tr>
            <th>{t('reports.columnMonth')}</th>
            <th>{t('summary.earned')}</th>
            <th>{t('summary.spent')}</th>
            <th>{t('summary.saved')}</th>
            <th>{t('reports.dailyAverage')}</th>
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((month) => {
            const dailyAverage = monthDailyAverage(month);
            return (
              <tr key={month.month}>
                <td>
                  <button
                    type="button"
                    className="text-button month-table-link"
                    onClick={() => onOpenMonth(month.month)}
                  >
                    {formatMonthTitle(month.month)}
                  </button>
                </td>
                <td>{formatEuros(month.earned)}</td>
                <td className={month.spent > month.budgeted ? 'is-negative' : ''}>{formatEuros(month.spent)}</td>
                <td className={month.saved >= 0 ? 'is-positive' : 'is-negative'}>{formatEuros(month.saved)}</td>
                <td>{dailyAverage === null ? '–' : formatEuros(dailyAverage)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
