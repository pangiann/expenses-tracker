import { useEffect, useState, useSyncExternalStore } from 'react';

import { BackupButtons } from '../features/backup/backup-buttons.tsx';
import { IncomeCard } from '../features/income/income-card.tsx';
import { LanguagePicker } from '../features/language/language-picker.tsx';
import { AddMonthDialog } from '../features/month-navigation/add-month-dialog.tsx';
import { MonthNavigation } from '../features/month-navigation/month-navigation.tsx';
import { QuickAdd } from '../features/quick-add/quick-add.tsx';
import { ErrorBanner } from '../features/status/error-banner.tsx';
import { SaveStatusPill } from '../features/status/save-status.tsx';
import { BudgetBars } from '../features/summary/budget-bars.tsx';
import { SpendingDonut } from '../features/summary/spending-donut.tsx';
import { SummaryCards } from '../features/summary/summary-cards.tsx';
import { t } from '../i18n/translator.ts';
import { monthPageStore } from './month-page-store.ts';
import { VanillaFeatures } from './vanilla-features.ts';

const openMonth = (monthKey: string) => void monthPageStore.openMonth(monthKey);

let vanillaFeatures: VanillaFeatures | null = null;

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

  // The features that aren't React components yet find their elements by id once React has drawn them.
  useEffect(() => {
    if (vanillaFeatures) return;
    vanillaFeatures = new VanillaFeatures();
    vanillaFeatures.start();
  }, []);

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
          <div id="categoryCards" className="category-cards"></div>
          <div className="side-column">
            {month && <IncomeCard month={month} />}

            <aside id="recurringCostsPanel" className="card recurring-costs-panel">
              <h2>{t('recurring.fixedCosts')}</h2>
              <ul id="fixedCostsList" className="recurring-cost-list"></ul>
              <h3>{t('recurring.subscriptions')}</h3>
              <ul id="subscriptionsList" className="recurring-cost-list"></ul>
              <div className="recurring-costs-total">
                <span>{t('recurring.total')}</span> <span id="recurringCostsTotal"></span>
              </div>
            </aside>
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
