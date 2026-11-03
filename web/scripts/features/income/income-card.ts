import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as incomeApi from '../../api/income-api.ts';
import { renderEntryRows } from '../../components/entry-rows.ts';
import { InlineNumberEditor } from '../../components/inline-number-editor.ts';
import { getElement } from '../../utils/html.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';
import { defaultExpenseDate } from '../../utils/month-keys.ts';

/**
 * The Income card: every amount earned this month (salary, each private lesson, ...), with
 * the total at the top. It works like a category card: add with the form at the bottom,
 * click an amount to change it, ✕ to remove it. Each calls one income endpoint.
 */
export class IncomeCard {
  readonly #totalElement = getElement('incomeTotal');
  readonly #listElement = getElement('incomeList');
  readonly #addForm = getElement('incomeAddForm', HTMLFormElement);
  readonly #amountInput: HTMLInputElement;
  readonly #descriptionInput: HTMLInputElement;
  #month: MonthRecord | null = null;

  constructor() {
    this.#amountInput = this.#addForm.elements.namedItem('amount') as HTMLInputElement;
    this.#descriptionInput = this.#addForm.elements.namedItem('description') as HTMLInputElement;
    this.#addForm.addEventListener('submit', (submitEvent) => {
      submitEvent.preventDefault();
      if (!this.#month) return;
      const isSent = incomeApi.addIncome(this.#month.monthKey, {
        amount: parseAmount(this.#amountInput.value) ?? 0,
        description: this.#descriptionInput.value,
        date: defaultExpenseDate(this.#month.monthKey),
      });
      if (!isSent) return;
      this.#addForm.reset();
      this.#amountInput.focus();
    });
    this.#listElement.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(month: MonthRecord): void {
    this.#month = month;
    this.#totalElement.textContent = formatEuros(month.totalIncome);
    this.#listElement.innerHTML = renderEntryRows(month.incomesNewestFirst(), 'income.untitled');
  }

  #handleClick(clickEvent: MouseEvent): void {
    const month = this.#month;
    const target = clickEvent.target as Element;
    if (!month) return;

    const deleteButton = target.closest<HTMLElement>('.delete-button');
    if (deleteButton?.dataset.entryId) {
      incomeApi.removeIncome(month.monthKey, deleteButton.dataset.entryId);
      return;
    }
    const amountElement = target.closest<HTMLElement>('.entry-amount');
    const income = amountElement && month.findIncome(amountElement.dataset.entryId ?? '');
    if (amountElement && income) {
      InlineNumberEditor.open(amountElement, {
        currentValue: income.amount,
        onSave: (newAmount) => incomeApi.changeIncomeAmount(month.monthKey, income.id, newAmount),
      });
    }
  }
}
