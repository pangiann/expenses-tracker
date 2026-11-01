import { getElement } from '../utils/html.js';
import { buildMonthKey, monthNames, parseMonthKey } from '../utils/monthKeys.js';

const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2999;

/** "Add a month" dialog: pick a month and year. */
export class AddMonthDialog {
  /**
   * @param {object} actions
   * @param {(monthKey: string) => void} actions.addMonth
   */
  constructor(actions) {
    this.backdrop = getElement('addMonthDialog');
    this.monthSelect = getElement('addMonthMonthSelect');
    this.yearInput = getElement('addMonthYearInput');
    this.errorMessage = getElement('addMonthError');

    this.monthSelect.innerHTML = monthNames()
      .map((monthName, monthIndex) => `<option value="${monthIndex + 1}">${monthName}</option>`)
      .join('');

    getElement('addMonthCancelButton').addEventListener('click', () => this.close());
    getElement('addMonthForm').addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      const year = Number.parseInt(this.yearInput.value, 10);
      if (!(year >= EARLIEST_YEAR && year <= LATEST_YEAR)) {
        this.errorMessage.textContent = 'Enter a valid year.';
        return;
      }
      this.close();
      actions.addMonth(buildMonthKey(year, Number(this.monthSelect.value)));
    });
  }

  /** @param {string} suggestedMonthKey  month selected when the dialog opens */
  open(suggestedMonthKey) {
    const { year, monthNumber } = parseMonthKey(suggestedMonthKey);
    this.monthSelect.value = String(monthNumber);
    this.yearInput.value = year;
    this.errorMessage.textContent = '';
    this.backdrop.hidden = false;
  }

  close() {
    this.backdrop.hidden = true;
  }
}
