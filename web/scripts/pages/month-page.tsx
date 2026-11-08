import { useState, useSyncExternalStore } from 'react';

import { CategoryCardsGrid } from '../features/categories/category-cards-grid.tsx';
import { IncomeCard } from '../features/income/income-card.tsx';
import { AddMonthDialog } from '../features/month-navigation/add-month-dialog.tsx';
import { MonthNavigation } from '../features/month-navigation/month-navigation.tsx';
import { QuickAdd } from '../features/quick-add/quick-add.tsx';
import { RecurringCostsPanel } from '../features/recurring-costs/recurring-costs-panel.tsx';
import { ErrorBanner } from '../features/status/error-banner.tsx';
import { UndoToast } from '../features/undo/undo-toast.tsx';
import { BudgetBars } from '../features/summary/budget-bars.tsx';
import { SpendingDonut } from '../features/summary/spending-donut.tsx';
import { SummaryCards } from '../features/summary/summary-cards.tsx';
import { PageTabs } from '../components/page-tabs.tsx';
import { monthPageState } from '../sync/month-page-state.ts';
import { TopBar } from './top-bar.tsx';

const openMonth = (monthKey: string) => void monthPageState.openMonth(monthKey);

/**
 * The month page, the app's main page (the other is pages/reports-page.tsx). Each part is a feature
 * (features/) that draws the month from sync/month-page-state.ts, handles its own clicks and
 * calls its API functions (api/*-api.ts). The page never handles an edit itself.
 */
/** The same function every time, so the undo toast's timer isn't restarted by each redraw. */
const dismissUndo = () => monthPageState.dismissUndo();

export function MonthPage() {
  const { month, savedMonthKeys, errorText, refusedEditText, removedItem } = useSyncExternalStore(
    monthPageState.subscribe,
    monthPageState.getSnapshot,
  );
  /** The month the "Add a month" dialog suggests; null while it is closed. */
  const [addMonthSuggestion, setAddMonthSuggestion] = useState<string | null>(null);

  return (
    <>
      <TopBar
        middle={
          <MonthNavigation
            monthKey={month?.monthKey ?? null}
            savedMonthKeys={savedMonthKeys}
            onOpenMonth={openMonth}
            onAddMonth={setAddMonthSuggestion}
          />
        }
      />

      <ErrorBanner text={errorText ?? refusedEditText} />

      <main className="page-content">
        <PageTabs currentPage="month" />
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

      <UndoToast removedItem={removedItem} onDismiss={dismissUndo} />
    </>
  );
}
