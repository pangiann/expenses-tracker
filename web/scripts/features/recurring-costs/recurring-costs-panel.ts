import { RecurringCostList, type RecurringCostListName } from '../../../../shared/month/categories.ts';
import type { MonthRecord, RecurringCost } from '../../../../shared/month/month-record.ts';
import * as recurringCostsApi from '../../api/recurring-costs-api.ts';
import { t } from '../../i18n/translator.ts';
import { escapeHtml, getElement } from '../../utils/html.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';

/**
 * Fixed costs and subscriptions panel. Every row's name and amount can be edited, rows can
 * be removed with ✕ and added with "+ Add"; each calls one recurring-cost endpoint.
 *
 * Each input carries data-list-name (which list) and data-cost-id (which row), so a change
 * reaches the right row even if someone else added or removed rows meanwhile.
 */
export class RecurringCostsPanel {
  readonly #panel = getElement('recurringCostsPanel');
  readonly #listElements: Record<RecurringCostListName, HTMLElement> = {
    [RecurringCostList.FIXED_COSTS]: getElement('fixedCostsList'),
    [RecurringCostList.SUBSCRIPTIONS]: getElement('subscriptionsList'),
  };
  readonly #totalElement = getElement('recurringCostsTotal');
  #month: MonthRecord | null = null;

  constructor() {
    this.#panel.addEventListener('input', (inputEvent) => this.#resizeAmountField(inputEvent.target));
    this.#panel.addEventListener('change', (changeEvent) => this.#handleChange(changeEvent.target));
    this.#panel.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(month: MonthRecord): void {
    this.#month = month;
    for (const listName of Object.values(RecurringCostList)) {
      this.#listElements[listName].innerHTML = this.#renderList(listName, month.recurringCostsIn(listName));
    }
    this.#totalElement.textContent = formatEuros(month.calculateTotals().recurringCostsTotal);
  }

  // ----- Event handling -----

  #handleChange(target: EventTarget | null): void {
    if (!(target instanceof HTMLInputElement) || !this.#month) return;
    const { listName, costId, field } = target.dataset;
    if (!isListName(listName) || !costId) return;
    if (field === 'name') {
      recurringCostsApi.renameRecurringCost(this.#month.monthKey, listName, costId, target.value);
    } else {
      recurringCostsApi.changeRecurringCostAmount(
        this.#month.monthKey,
        listName,
        costId,
        parseAmount(target.value) ?? 0,
      );
    }
  }

  #handleClick(clickEvent: MouseEvent): void {
    const target = clickEvent.target as Element;
    if (!this.#month) return;

    const deleteButton = target.closest<HTMLElement>('.delete-button');
    if (deleteButton) {
      const { listName, costId } = deleteButton.dataset;
      if (isListName(listName) && costId) recurringCostsApi.removeRecurringCost(this.#month.monthKey, listName, costId);
      return;
    }

    const listName = target.closest<HTMLElement>('[data-add-to-list]')?.dataset.addToList;
    if (isListName(listName)) {
      recurringCostsApi.addRecurringCost(this.#month.monthKey, listName, t('recurring.newItem'));
      this.#selectLastRowName(listName);
    }
  }

  /** After adding a row (drawn at once, see api/month-with-pending-edits.ts), select its "New item" name to type over it. */
  #selectLastRowName(listName: RecurringCostListName): void {
    const nameInputs = this.#listElements[listName].querySelectorAll<HTMLInputElement>('.recurring-cost-name');
    nameInputs[nameInputs.length - 1]?.select();
  }

  /** Keeps the amount field as wide as its number, so the € sits right next to it. */
  #resizeAmountField(target: EventTarget | null): void {
    if (target instanceof HTMLInputElement && target.dataset.field === 'amount') {
      target.style.width = widthForValue(target.value);
    }
  }

  // ----- HTML -----

  #renderList(listName: RecurringCostListName, costs: readonly RecurringCost[]): string {
    const rows = costs.map((cost) => {
      const rowAttributes = `data-list-name="${listName}" data-cost-id="${escapeHtml(cost.id)}"`;
      return `
        <li class="recurring-cost-row">
          <input class="recurring-cost-name" value="${escapeHtml(cost.name)}" ${rowAttributes} data-field="name">
          <label class="recurring-cost-amount">€<input type="number" step="0.01" min="0" value="${cost.amount}"
                 ${rowAttributes} data-field="amount" style="width:${widthForValue(cost.amount)}"></label>
          <button class="delete-button" ${rowAttributes} title="${escapeHtml(t('recurring.remove'))}">✕</button>
        </li>`;
    });
    rows.push(`<li class="recurring-cost-add-row">
      <button class="text-button" data-add-to-list="${listName}">${escapeHtml(t('recurring.add'))}</button></li>`);
    return rows.join('');
  }
}

function isListName(value: string | undefined): value is RecurringCostListName {
  return value === RecurringCostList.FIXED_COSTS || value === RecurringCostList.SUBSCRIPTIONS;
}

function widthForValue(value: string | number): string {
  return `${Math.max(String(value).length, 1) + 0.5}ch`;
}
