/**
 * Categories have no color of their own. Only the spending donut needs colors, to tell its
 * slices apart: each category takes the chart color of its position in the month's list, so it
 * keeps its color while the order stays the same. base.css defines --chart-1 … --chart-12 for
 * the light and dark themes.
 */
const CHART_COLOR_COUNT = 12;

/** The chart color for the category at this position (0 for the first), as a CSS value. */
export function chartColorForPosition(position: number): string {
  return `var(--chart-${(position % CHART_COLOR_COUNT) + 1})`;
}
