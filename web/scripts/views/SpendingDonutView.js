import { SPENDING_CATEGORIES } from '../config/categories.js';
import { getElement } from '../utils/html.js';
import { formatEuros, sumAmounts } from '../utils/money.js';

// Chart geometry inside the SVG's 120 x 120 viewBox.
const CHART_CENTER = 60;
const RING_RADIUS = 46;
const RING_WIDTH = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Donut chart of variable spending per category, with a legend. */
export class SpendingDonutView {
  constructor() {
    this.chartElement = getElement('spendingDonutChart');
    this.legendElement = getElement('spendingDonutLegend');
  }

  render(monthRecord) {
    const slices = SPENDING_CATEGORIES
      .map((category) => ({ category, amount: monthRecord.spentInCategory(category.key) }))
      .filter((slice) => slice.amount > 0);
    const totalAmount = sumAmounts(slices.map((slice) => slice.amount));

    this.chartElement.innerHTML = this.#renderRing(slices, totalAmount) + this.#renderCenterLabel(totalAmount);
    this.legendElement.innerHTML = this.#renderLegend(slices, totalAmount);
  }

  /** Each slice is a circle whose visible stroke covers its share of the ring. */
  #renderRing(slices, totalAmount) {
    const emptyRing = this.#ringCircle('var(--color-track)', '', '');
    let distanceAlongRing = 0;
    const sliceCircles = slices.map((slice) => {
      const sliceLength = (slice.amount / totalAmount) * RING_CIRCUMFERENCE;
      const circle = this.#ringCircle(
        slice.category.color,
        `stroke-dasharray="${sliceLength} ${RING_CIRCUMFERENCE - sliceLength}"`,
        `stroke-dashoffset="${-distanceAlongRing}"`);
      distanceAlongRing += sliceLength;
      return circle;
    });
    return emptyRing + sliceCircles.join('');
  }

  #ringCircle(strokeColor, dashArrayAttribute, dashOffsetAttribute) {
    return `<circle cx="${CHART_CENTER}" cy="${CHART_CENTER}" r="${RING_RADIUS}" fill="none"
      stroke="${strokeColor}" stroke-width="${RING_WIDTH}" ${dashArrayAttribute} ${dashOffsetAttribute}
      transform="rotate(-90 ${CHART_CENTER} ${CHART_CENTER})"/>`;
  }

  #renderCenterLabel(totalAmount) {
    return `
      <text x="${CHART_CENTER}" y="60" text-anchor="middle" class="spending-donut-total">${formatEuros(totalAmount)}</text>
      <text x="${CHART_CENTER}" y="71" text-anchor="middle" class="spending-donut-caption">variable spending</text>`;
  }

  #renderLegend(slices, totalAmount) {
    if (slices.length === 0) return '<li class="spending-donut-legend-empty">No expenses yet</li>';
    return [...slices]
      .sort((first, second) => second.amount - first.amount)
      .map((slice) => {
        const percentage = ((slice.amount / totalAmount) * 100).toFixed(0);
        return `
          <li>
            <span class="color-dot" style="background:${slice.category.color}"></span>
            ${slice.category.displayName}
            <span class="spending-donut-legend-value">${percentage}% · ${formatEuros(slice.amount)}</span>
          </li>`;
      })
      .join('');
  }
}
