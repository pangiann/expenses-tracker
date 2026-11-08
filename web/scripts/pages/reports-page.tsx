import { useState } from 'react';

import { PageTabs } from '../components/page-tabs.tsx';
import { ReportsView } from '../features/reports/reports-view.tsx';
import { t } from '../i18n/translator.ts';
import { monthPageState } from '../sync/month-page-state.ts';
import { currentMonthKey } from '../utils/month-keys.ts';
import { goToPage } from '../utils/page-route.ts';
import { TopBar } from './top-bar.tsx';

/** Opening a month from the report: the month page loads it, then shows it. */
function openMonthPage(monthKey: string): void {
  void monthPageState.openMonth(monthKey);
  goToPage('month');
}

/**
 * The reports page: a year in totals (features/reports/). It starts on the current year.
 * The year is kept while the page is open, not in the address.
 */
export function ReportsPage() {
  const [year, setYear] = useState(() => Number(currentMonthKey().slice(0, 4)));
  return (
    <>
      <TopBar
        middle={
          <nav className="month-navigation">
            <h1>{t('pages.reports')}</h1>
          </nav>
        }
      />
      <main className="page-content">
        <PageTabs currentPage="reports" />
        <ReportsView year={year} onChangeYear={setYear} onOpenMonth={openMonthPage} />
      </main>
    </>
  );
}
