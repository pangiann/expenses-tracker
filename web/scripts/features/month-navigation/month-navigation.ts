import { getElement } from '../../utils/html.ts';
import { currentMonthKey, formatMonthTitle, nextMonthKey } from '../../utils/month-keys.ts';
import { AddMonthDialog } from './add-month-dialog.ts';

/**
 * The month title in the top bar, with ‹ › to move between saved months and + to add one.
 * Moving to a month calls openMonth, which loads it from the server (the server creates a
 * month that doesn't exist yet).
 */
export class MonthNavigation {
  readonly #titleElement = getElement('monthTitle');
  readonly #previousButton = getElement('previousMonthButton', HTMLButtonElement);
  readonly #nextButton = getElement('nextMonthButton', HTMLButtonElement);
  readonly #addMonthDialog: AddMonthDialog;
  #monthKey: string | null = null;
  #savedMonthKeys: readonly string[] = [];

  constructor(openMonth: (monthKey: string) => void) {
    this.#addMonthDialog = new AddMonthDialog(openMonth);
    this.#previousButton.addEventListener('click', () => this.#openSavedMonthAt(-1, openMonth));
    this.#nextButton.addEventListener('click', () => this.#openSavedMonthAt(+1, openMonth));
    getElement('addMonthButton').addEventListener('click', () => this.#addMonthDialog.open(this.#suggestedNewMonth()));
  }

  /** @param savedMonthKeys  every saved month, oldest first */
  render(monthKey: string, savedMonthKeys: readonly string[]): void {
    this.#monthKey = monthKey;
    this.#savedMonthKeys = savedMonthKeys;
    const position = savedMonthKeys.indexOf(monthKey);
    this.#titleElement.textContent = formatMonthTitle(monthKey);
    this.#previousButton.disabled = position <= 0;
    this.#nextButton.disabled = position < 0 || position >= savedMonthKeys.length - 1;
  }

  #openSavedMonthAt(offset: number, openMonth: (monthKey: string) => void): void {
    if (!this.#monthKey) return;
    const target = this.#savedMonthKeys[this.#savedMonthKeys.indexOf(this.#monthKey) + offset];
    if (target) openMonth(target);
  }

  /** The month after the latest saved one, or the current month when none is saved. */
  #suggestedNewMonth(): string {
    const latestMonthKey = this.#savedMonthKeys.at(-1);
    return latestMonthKey ? nextMonthKey(latestMonthKey) : currentMonthKey();
  }
}
