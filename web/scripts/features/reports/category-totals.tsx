import type { YearSummary } from '../../../../shared/month/year-summary.ts';
import { CardTitle } from '../../components/card-title.tsx';
import { categoryName, t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';
import { categoryTotals } from './report-numbers.ts';

/**
 * "By category": each category's variable spending in the year, largest first, as a bar of its
 * share, with its average per saved month. Same bars as "Budget vs actual" on the month page.
 */
export function CategoryTotals({ summary }: { summary: YearSummary }) {
  const categoriesById = new Map(summary.categories.map((category) => [category.id, category]));
  const totals = categoryTotals(summary);
  return (
    <div className="card">
      <CardTitle
        icon="chartColumn"
        titleStringId="reports.categoriesTitle"
        descriptionStringId="reports.categoriesDescription"
      />
      {totals.length === 0 ? (
        <p className="card-description">{t('charts.noExpensesYet')}</p>
      ) : (
        <div className="budget-bars">
          {totals.map(({ categoryId, spent, share }) => {
            const category = categoriesById.get(categoryId);
            return (
              <div key={categoryId} className="budget-bar-row">
                <span>{category ? categoryName(category) : categoryId}</span>
                <div className="budget-bar-track">
                  <div
                    className="budget-bar-fill"
                    style={{ width: `${share * 100}%`, background: 'var(--color-accent)' }}
                  ></div>
                </div>
                <span className="budget-bar-amount">{`${Math.round(share * 100)}% · ${formatEuros(spent)}`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
