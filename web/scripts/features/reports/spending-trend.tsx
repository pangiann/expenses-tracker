import type { YearSummary } from '../../../../shared/month/year-summary.ts';
import { CardTitle } from '../../components/card-title.tsx';
import { monthName, t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';

// Chart geometry inside the SVG's viewBox, in its own units; the SVG scales to the card's width.
const WIDTH = 600;
const HEIGHT = 200;
const LEFT = 8;
const RIGHT = 8;
const TOP = 12;
const BOTTOM = 2; // the month names are below the SVG, as text that keeps its size on phones
const SLOT = (WIDTH - LEFT - RIGHT) / 12;
const BAR_WIDTH = 13;
const GRID_LINES = 4;

/**
 * "By month": for each month of the year, what came in (gray) and what went out (black, or
 * white in dark mode), as bars side by side. Months without a saved month stay empty.
 */
export function SpendingTrend({ summary }: { summary: YearSummary }) {
  const monthsByNumber = new Map(summary.months.map((month) => [Number(month.month.slice(5, 7)), month]));
  const largest = Math.max(1, ...summary.months.flatMap((month) => [month.earned, month.spent]));
  const chartHeight = HEIGHT - TOP - BOTTOM;
  const barHeight = (amount: number) => (Math.max(0, amount) / largest) * chartHeight;

  return (
    <div className="card">
      <CardTitle icon="trendingUp" titleStringId="reports.trendTitle" descriptionStringId="reports.trendDescription" />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="spending-trend-chart"
        role="img"
        aria-label={t('reports.trendTitle')}
      >
        {Array.from({ length: GRID_LINES + 1 }, (_, line) => {
          const y = TOP + (chartHeight * line) / GRID_LINES;
          return <line key={line} x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} className="spending-trend-grid" />;
        })}
        {Array.from({ length: 12 }, (_, index) => {
          const monthNumber = index + 1;
          const month = monthsByNumber.get(monthNumber);
          const center = LEFT + SLOT * index + SLOT / 2;
          return (
            <g key={monthNumber}>
              {month && (
                <>
                  <rect
                    x={center - BAR_WIDTH - 1}
                    y={TOP + chartHeight - barHeight(month.earned)}
                    width={BAR_WIDTH}
                    height={barHeight(month.earned)}
                    rx={3}
                    className="spending-trend-earned"
                  >
                    <title>{`${monthName(monthNumber)}: ${t('summary.earned')} ${formatEuros(month.earned)}`}</title>
                  </rect>
                  <rect
                    x={center + 1}
                    y={TOP + chartHeight - barHeight(month.spent)}
                    width={BAR_WIDTH}
                    height={barHeight(month.spent)}
                    rx={3}
                    className={`spending-trend-spent ${month.spent > month.earned ? 'is-over' : ''}`.trim()}
                  >
                    <title>{`${monthName(monthNumber)}: ${t('summary.spent')} ${formatEuros(month.spent)}`}</title>
                  </rect>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {/* Twelve equal columns, inset like the bars' slots, so each name sits under its month. */}
      <div
        className="spending-trend-labels"
        style={{ paddingLeft: `${(LEFT / WIDTH) * 100}%`, paddingRight: `${(RIGHT / WIDTH) * 100}%` }}
      >
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index}>{monthName(index + 1).slice(0, 3)}</span>
        ))}
      </div>
      <div className="spending-trend-legend">
        <span>
          <span className="color-dot spending-trend-earned-dot"></span>
          {t('summary.earned')}
        </span>
        <span>
          <span className="color-dot spending-trend-spent-dot"></span>
          {t('summary.spent')}
        </span>
        <span className="spending-trend-largest">{t('reports.largestBar', { amount: formatEuros(largest) })}</span>
      </div>
    </div>
  );
}
