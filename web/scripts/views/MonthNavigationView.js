import { getElement } from '../utils/html.js';
import { formatMonthTitle } from '../utils/monthKeys.js';

/** Month title with the ‹ › buttons and the + button in the top bar. */
export class MonthNavigationView {
  /**
   * @param {object} actions
   * @param {() => void} actions.showPreviousMonth
   * @param {() => void} actions.showNextMonth
   * @param {() => void} actions.requestNewMonth
   */
  constructor(actions) {
    this.titleElement = getElement('monthTitle');
    this.previousButton = getElement('previousMonthButton');
    this.nextButton = getElement('nextMonthButton');

    this.previousButton.addEventListener('click', () => actions.showPreviousMonth());
    this.nextButton.addEventListener('click', () => actions.showNextMonth());
    getElement('addMonthButton').addEventListener('click', () => actions.requestNewMonth());
  }

  /**
   * @param {string} monthKey  the month on screen
   * @param {string[]} savedMonthKeys  all saved months, oldest first
   */
  render(monthKey, savedMonthKeys) {
    const position = savedMonthKeys.indexOf(monthKey);
    this.titleElement.textContent = formatMonthTitle(monthKey);
    this.previousButton.disabled = position <= 0;
    this.nextButton.disabled = position < 0 || position >= savedMonthKeys.length - 1;
  }

  showTitle(text) {
    this.titleElement.textContent = text;
  }
}
