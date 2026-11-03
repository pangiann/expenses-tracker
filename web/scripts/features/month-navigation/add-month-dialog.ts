import { t } from '../../i18n/translator.ts';
import { escapeHtml, getElement } from '../../utils/html.ts';
import { buildMonthKey, monthNames, parseMonthKey } from '../../utils/month-keys.ts';

const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2999;

/** "Add a month" dialog: pick a month and year, then open it (the server creates it). */
export class AddMonthDialog {
  readonly backdrop = getElement('addMonthDialog');
  readonly monthSelect = getElement('addMonthMonthSelect', HTMLSelectElement);
  readonly yearInput = getElement('addMonthYearInput', HTMLInputElement);
  readonly errorMessage = getElement('addMonthError');

  constructor(openMonth: (monthKey: string) => void) {
    this.monthSelect.innerHTML = monthNames()
      .map((monthName, monthIndex) => `<option value="${monthIndex + 1}">${escapeHtml(monthName)}</option>`)
      .join('');

    getElement('addMonthCancelButton').addEventListener('click', () => this.close());
    getElement('addMonthForm').addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      const year = Number.parseInt(this.yearInput.value, 10);
      if (!(year >= EARLIEST_YEAR && year <= LATEST_YEAR)) {
        this.errorMessage.textContent = t('addMonth.invalidYear');
        return;
      }
      this.close();
      openMonth(buildMonthKey(year, Number(this.monthSelect.value)));
    });
  }

  /** @param suggestedMonthKey  month selected when the dialog opens */
  open(suggestedMonthKey: string): void {
    const { year, monthNumber } = parseMonthKey(suggestedMonthKey);
    this.monthSelect.value = String(monthNumber);
    this.yearInput.value = String(year);
    this.errorMessage.textContent = '';
    this.backdrop.hidden = false;
  }

  close(): void {
    this.backdrop.hidden = true;
  }
}
