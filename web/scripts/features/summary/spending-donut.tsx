import { sumAmounts } from '../../../../shared/month/amounts.ts';
import type { Category } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import { categoryName, t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';
import { CardTitle } from '../../components/card-title.tsx';
import { chartColorForPosition } from '../../utils/chart-colors.ts';

// Chart geometry inside the SVG's 120 x 120 viewBox.
const CHART_CENTER = 60;
const RING_RADIUS = 46;
const RING_WIDTH = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface Slice {
  category: Category;
  amount: number;
  /** the category's chart color (utils/chart-colors.ts), from its position in the month */
  color: string;
  /** length of the slice along the ring, and where it starts */
  lengthAlongRing: number;
  startAlongRing: number;
}

/** "Where the money went": a donut chart of variable spending per category, with a legend. */
export function SpendingDonut({ month }: { month: MonthRecord }) {
  const spentPerCategory = month.categories
    .map((category, position) => ({
      category,
      amount: month.spentInCategory(category.id),
      color: chartColorForPosition(position),
    }))
    .filter(({ amount }) => amount > 0);
  const totalAmount = sumAmounts(spentPerCategory.map(({ amount }) => amount));
  // Each slice starts where the one before it ends.
  const slices = spentPerCategory.reduce<Slice[]>((slicesSoFar, { category, amount, color }) => {
    const previousSlice = slicesSoFar.at(-1);
    const startAlongRing = previousSlice ? previousSlice.startAlongRing + previousSlice.lengthAlongRing : 0;
    return [
      ...slicesSoFar,
      { category, amount, color, lengthAlongRing: (amount / totalAmount) * RING_CIRCUMFERENCE, startAlongRing },
    ];
  }, []);

  return (
    <div className="card">
      <CardTitle
        icon="chartPie"
        titleStringId="charts.whereMoneyWent"
        descriptionStringId="charts.whereMoneyWentDescription"
      />
      <div className="spending-donut">
        <svg viewBox="0 0 120 120" className="spending-donut-chart">
          <RingCircle strokeColor="var(--color-track)" />
          {/* Each slice is a circle whose visible stroke covers its share of the ring. */}
          {slices.map((slice) => (
            <RingCircle
              key={slice.category.id}
              strokeColor={slice.color}
              strokeDasharray={`${slice.lengthAlongRing} ${RING_CIRCUMFERENCE - slice.lengthAlongRing}`}
              strokeDashoffset={-slice.startAlongRing}
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
                  <span className="color-dot" style={{ background: slice.color }}></span>
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
