import type { Category } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import { categoryName } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';
import { CardTitle } from '../../components/card-title.tsx';

/** "Budget vs actual": one bar per category, spent compared to budget, red when over budget. */
export function BudgetBars({ month }: { month: MonthRecord }) {
  return (
    <div className="card">
      <CardTitle
        icon="chartColumn"
        titleStringId="charts.budgetVsActual"
        descriptionStringId="charts.budgetVsActualDescription"
      />
      <div className="budget-bars">
        {month.categories.map((category) => (
          <BudgetBar key={category.id} category={category} month={month} />
        ))}
      </div>
    </div>
  );
}

function BudgetBar({ category, month }: { category: Category; month: MonthRecord }) {
  const spent = month.spentInCategory(category.id);
  const budget = month.budgetFor(category.id);
  const isOverBudget = spent > budget;
  const fillPercentage = budget > 0 ? Math.min(spent / budget, 1) * 100 : spent > 0 ? 100 : 0;
  return (
    <div className="budget-bar-row">
      <span>{categoryName(category)}</span>
      <div className="budget-bar-track">
        <div
          className="budget-bar-fill"
          style={{ width: `${fillPercentage}%`, background: isOverBudget ? 'var(--color-negative)' : category.color }}
        ></div>
      </div>
      <span className={`budget-bar-amount ${isOverBudget ? 'is-negative' : ''}`}>
        {`${formatEuros(spent)} / ${formatEuros(budget)}`}
      </span>
    </div>
  );
}
