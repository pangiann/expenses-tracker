import { useState, useSyncExternalStore } from 'react';

import { BackupButtons } from '../features/backup/backup-buttons.tsx';
import { CategoryCardsGrid } from '../features/categories/category-cards-grid.tsx';
import { IncomeCard } from '../features/income/income-card.tsx';
import { LanguagePicker } from '../features/language/language-picker.tsx';
import { AddMonthDialog } from '../features/month-navigation/add-month-dialog.tsx';
import { MonthNavigation } from '../features/month-navigation/month-navigation.tsx';
import { QuickAdd } from '../features/quick-add/quick-add.tsx';
import { RecurringCostsPanel } from '../features/recurring-costs/recurring-costs-panel.tsx';
import { ErrorBanner } from '../features/status/error-banner.tsx';
import { SaveStatusPill } from '../features/status/save-status.tsx';
import { BudgetBars } from '../features/summary/budget-bars.tsx';
import { SpendingDonut } from '../features/summary/spending-donut.tsx';
import { SummaryCards } from '../features/summary/summary-cards.tsx';
import { t } from '../i18n/translator.ts';
import { monthPageStore } from './month-page-store.ts';

const openMonth = (monthKey: string) => void monthPageStore.openMonth(monthKey);

/**
 * The month page: the only page of the app. Each part of the page is a feature
 * (features/) that draws the month from month-page-store.ts, handles its own clicks and
 * calls its API functions (api/*-api.ts). The page never handles an edit itself.
 */
export function MonthPage() {
  const { month, savedMonthKeys, saveStatus, errorText } = useSyncExternalStore(
    monthPageStore.subscribe,
    monthPageStore.getState,
  );
  /** The month the "Add a month" dialog suggests; null while it is closed. */
  const [addMonthSuggestion, setAddMonthSuggestion] = useState<string | null>(null);

  return (
    <>
      <header className="top-bar">
        <div className="brand">
          <img src="assets/icon.svg" alt="" className="brand-icon" /> <span>{t('app.title')}</span>
        </div>
        <MonthNavigation
          monthKey={month?.monthKey ?? null}
          savedMonthKeys={savedMonthKeys}
          onOpenMonth={openMonth}
          onAddMonth={setAddMonthSuggestion}
        />
        <div className="top-bar-actions">
          <SaveStatusPill saveStatus={saveStatus} />
          <LanguagePicker />
          <BackupButtons onImported={() => monthPageStore.reloadShownMonth()} />
        </div>
      </header>

      <ErrorBanner text={errorText} />

      <main className="page-content">
        {month && (
          <>
            <QuickAdd month={month} />
            <SummaryCards month={month} />
            <section className="charts">
              <BudgetBars month={month} />
              <SpendingDonut month={month} />
            </section>
          </>
        )}

        <section className="month-details">
          {month && <CategoryCardsGrid month={month} />}
          <div className="side-column">
            {month && <IncomeCard month={month} />}

            {month && <RecurringCostsPanel month={month} />}
          </div>
        </section>
      </main>

      <AddMonthDialog
        suggestedMonthKey={addMonthSuggestion}
        onOpenMonth={openMonth}
        onClose={() => setAddMonthSuggestion(null)}
      />
    </>
  );
}
