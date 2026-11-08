import { useEffect, useState } from 'react';

import type { YearSummary } from '../../../../shared/month/year-summary.ts';
import { loadYearSummary } from '../../api/reports-api.ts';
import { t } from '../../i18n/translator.ts';
import { CategoryTotals } from './category-totals.tsx';
import { MonthTable } from './month-table.tsx';
import { SpendingTrend } from './spending-trend.tsx';
import { YearNavigation } from './year-navigation.tsx';
import { YearTotalsCards } from './year-totals-cards.tsx';

/**
 * The reports page's content for one year: the year's totals, spending month by month, the
 * categories, and a table of months. It loads GET /api/years/:year/summary when shown and
 * whenever the year changes; a report changes nothing, so it needs no outbox.
 * @param onChangeYear  shows another year
 * @param onOpenMonth  shows that month on the month page
 */
export function ReportsView({
  year,
  onChangeYear,
  onOpenMonth,
}: {
  year: number;
  onChangeYear: (year: number) => void;
  onOpenMonth: (monthKey: string) => void;
}) {
  /** The last answer and the year it is for; another year shows "Loading…" until its answer comes. */
  const [answer, setAnswer] = useState<{ year: number; summary: YearSummary | null } | null>(null);

  useEffect(() => {
    let isCurrent = true; // a slow answer for a year no longer shown is dropped
    loadYearSummary(year).then(
      (summary) => isCurrent && setAnswer({ year, summary }),
      (error: unknown) => {
        console.error(error);
        if (isCurrent) setAnswer({ year, summary: null }); // null: it failed
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [year]);

  const summary = answer?.year === year ? answer.summary : undefined;
  const hasFailed = summary === null;
  if (hasFailed) return <p className="reports-message">{t('reports.loadFailed')}</p>;
  // While another year loads, the previous year's list of years keeps the ‹ › usable.
  const navigation = (
    <YearNavigation year={year} savedYears={answer?.summary?.savedYears ?? [year]} onChangeYear={onChangeYear} />
  );
  if (!summary)
    return (
      <>
        {navigation}
        <p className="reports-message">{t('app.loading')}</p>
      </>
    );
  if (summary.months.length === 0)
    return (
      <>
        {navigation}
        <p className="reports-message">{t('reports.noMonths', { year })}</p>
      </>
    );
  return (
    <>
      {navigation}
      <YearTotalsCards summary={summary} />
      <section className="charts">
        <SpendingTrend summary={summary} />
        <CategoryTotals summary={summary} />
      </section>
      <MonthTable summary={summary} onOpenMonth={onOpenMonth} />
    </>
  );
}
