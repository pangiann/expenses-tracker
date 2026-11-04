import { sumAmounts } from '../../../../shared/month/amounts.ts';
import type { Category } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import { categoryName, t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';

// Chart geometry inside the SVG's 120 x 120 viewBox.
const CHART_CENTER = 60;
const RING_RADIUS = 46;
const RING_WIDTH = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface Slice {
  category: Category;
  amount: number;
  /** length of the slice along the ring, and where it starts */
  length: number;
  start: number;
}

/** "Where the money went": a donut chart of variable spending per category, with a legend. */
export function SpendingDonut({ month }: { month: MonthRecord }) {
  const spentPerCategory = month.categories
    .map((category) => ({ category, amount: month.spentInCategory(category.id) }))
    .filter(({ amount }) => amount > 0);
  const totalAmount = sumAmounts(spentPerCategory.map(({ amount }) => amount));
  // Each slice starts where the one before it ends.
  const slices = spentPerCategory.reduce<Slice[]>((done, { category, amount }) => {
    const previous = done.at(-1);
    const start = previous ? previous.start + previous.length : 0;
    return [...done, { category, amount, length: (amount / totalAmount) * RING_CIRCUMFERENCE, start }];
  }, []);

  return (
    <div className="card">
      <h2>{t('charts.whereMoneyWent')}</h2>
      <div className="spending-donut">
        <svg viewBox="0 0 120 120" className="spending-donut-chart">
          <RingCircle strokeColor="var(--color-track)" />
          {/* Each slice is a circle whose visible stroke covers its share of the ring. */}
          {slices.map((slice) => (
            <RingCircle
              key={slice.category.id}
              strokeColor={slice.category.color}
              strokeDasharray={`${slice.length} ${RING_CIRCUMFERENCE - slice.length}`}
              strokeDashoffset={-slice.start}
            />
          ))}
          <text x={CHART_CENTER} y="60" textAnchor="middle" className="spending-donut-total">
            {formatEuros(totalAmount)}
          </text>
          <text x={CHART_CENTER} y="71" textAnchor="middle" className="spending-donut-caption">
            {t('charts.variableSpendingCaption')}
          </text>
        </svg>
        <ul className="spending-donut-legend">
          {slices.length === 0 ? (
            <li className="spending-donut-legend-empty">{t('charts.noExpensesYet')}</li>
          ) : (
            [...slices]
              .sort((first, second) => second.amount - first.amount)
              .map((slice) => (
                <li key={slice.category.id}>
                  <span className="color-dot" style={{ background: slice.category.color }}></span>
                  <span className="spending-donut-legend-name">{categoryName(slice.category)}</span>
                  <span className="spending-donut-legend-value">
                    {`${((slice.amount / totalAmount) * 100).toFixed(0)}% · ${formatEuros(slice.amount)}`}
                  </span>
                </li>
              ))
          )}
        </ul>
      </div>
    </div>
  );
}

function RingCircle({
  strokeColor,
  strokeDasharray,
  strokeDashoffset,
}: {
  strokeColor: string;
  strokeDasharray?: string;
  strokeDashoffset?: number;
}) {
  return (
    <circle
      cx={CHART_CENTER}
      cy={CHART_CENTER}
      r={RING_RADIUS}
      fill="none"
      stroke={strokeColor}
      strokeWidth={RING_WIDTH}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      transform={`rotate(-90 ${CHART_CENTER} ${CHART_CENTER})`}
    />
  );
}
