import { useEffect, useState, useSyncExternalStore } from 'react';

import { BackupButtons } from '../features/backup/backup-buttons.tsx';
import { LanguagePicker } from '../features/language/language-picker.tsx';
import { AddMonthDialog } from '../features/month-navigation/add-month-dialog.tsx';
import { MonthNavigation } from '../features/month-navigation/month-navigation.tsx';
import { ErrorBanner } from '../features/status/error-banner.tsx';
import { SaveStatusPill } from '../features/status/save-status.tsx';
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
        <section className="card quick-add">
          <h2>{t('quickAdd.title')}</h2>
          <form id="quickAddForm" className="quick-add-form" autoComplete="off">
            <input
              id="quickAddAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder={t('common.amountPlaceholder')}
              required
            />
            <input id="quickAddDescription" type="text" placeholder={t('common.descriptionPlaceholder')} />
            <select id="quickAddCategory" required></select>
            <input id="quickAddDate" type="date" />
            <button type="submit" className="primary-button">
              {t('common.add')}
            </button>
          </form>
        </section>

        <section className="summary-cards">
          <div className="card summary-card">
            <div className="summary-card-label">{t('summary.earned')}</div>
            <div className="summary-card-value" id="totalIncomeValue"></div>
            <div className="summary-card-detail">
              <span>{t('summary.expected')}</span> <span id="expectedIncomeSlot"></span>
            </div>
          </div>
          <div className="card summary-card">
            <div className="summary-card-label">{t('summary.spent')}</div>
            <div className="summary-card-value" id="totalSpentValue"></div>
            <div className="summary-card-detail">
              <span>{t('summary.budgeted')}</span> <span id="totalBudgetedValue"></span>
            </div>
          </div>
          <div className="card summary-card">
            <div className="summary-card-label">{t('summary.saved')}</div>
            <div className="summary-card-value" id="savedValue"></div>
            <div className="summary-card-detail">
              <span>{t('summary.expected')}</span> <span id="expectedSavingsValue"></span>
            </div>
          </div>
          <div className="card summary-card">
            <div className="summary-card-label">{t('summary.savingsRate')}</div>
            <div className="summary-card-value" id="savingsRateValue"></div>
            <div className="summary-card-detail">
              <span>{t('summary.variableSpending')}</span> <span id="variableSpendingValue"></span>
            </div>
          </div>
        </section>

        <section className="charts">
          <div className="card">
            <h2>{t('charts.budgetVsActual')}</h2>
            <div id="budgetBars" className="budget-bars"></div>
          </div>
          <div className="card">
            <h2>{t('charts.whereMoneyWent')}</h2>
            <div className="spending-donut">
              <svg id="spendingDonutChart" viewBox="0 0 120 120" className="spending-donut-chart"></svg>
              <ul id="spendingDonutLegend" className="spending-donut-legend"></ul>
            </div>
          </div>
        </section>

        <section className="month-details">
          <div id="categoryCards" className="category-cards"></div>
          <div className="side-column">
            <section className="card category-card income-card">
              <div className="category-card-header income-card-header">
                <div className="category-card-title">
                  <h2>{t('income.title')}</h2>
                  <span id="incomeTotal" className="category-card-spent"></span>
                </div>
              </div>
              <ul id="incomeList" className="expense-list"></ul>
              <form id="incomeAddForm" className="category-add-form" autoComplete="off">
                <input name="description" placeholder={t('income.descriptionPlaceholder')} />
                <input name="amount" type="number" step="0.01" min="0" placeholder="€" required />
                <button type="submit" title={t('common.add')}>
                  +
                </button>
              </form>
            </section>

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
