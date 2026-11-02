import { RecurringCostList } from '../config/categories.js';
import { escapeHtml, getElement } from '../utils/html.js';
import { formatEuros, parseAmount } from '../utils/money.js';

/**
 * Fixed costs and subscriptions panel. Every row's name and amount can be edited,
 * rows can be removed with ✕ and added with "+ Add".
 *
 * Each input carries data-list-name (which list) and data-cost-id (which row), so a change
 * reaches the right row even if someone else added or removed rows meanwhile.
 */
export class RecurringCostsView {
  /**
   * @param {object} actions
   * @param {(listName: string) => void} actions.addRecurringCost
   * @param {(listName: string, costId: string) => void} actions.removeRecurringCost
   * @param {(listName: string, costId: string, name: string) => void} actions.renameRecurringCost
   * @param {(listName: string, costId: string, amount: number) => void} actions.changeRecurringCostAmount
   */
  constructor(actions) {
    this.actions = actions;
    this.panel = getElement('recurringCostsPanel');
    this.listElements = {
      [RecurringCostList.FIXED_COSTS]: getElement('fixedCostsList'),
      [RecurringCostList.SUBSCRIPTIONS]: getElement('subscriptionsList'),
    };
    this.totalElement = getElement('recurringCostsTotal');

    this.panel.addEventListener('input', (inputEvent) => this.#resizeAmountField(inputEvent.target));
    this.panel.addEventListener('change', (changeEvent) => this.#handleChange(changeEvent.target));
    this.panel.addEventListener('click', (clickEvent) => this.#handleClick(clickEvent));
  }

  render(monthRecord) {
    for (const [listName, listElement] of Object.entries(this.listElements)) {
      listElement.innerHTML = this.#renderList(listName, monthRecord.recurringCostsIn(listName));
    }
    this.totalElement.textContent = formatEuros(monthRecord.calculateTotals().recurringCostsTotal);
  }

  // ----- Event handling -----

  #handleChange(changedInput) {
    const { listName, costId, field } = changedInput.dataset;
    if (!listName) return;
    if (field === 'name') {
      this.actions.renameRecurringCost(listName, costId, changedInput.value);
    } else {
      this.actions.changeRecurringCostAmount(listName, costId, parseAmount(changedInput.value) ?? 0);
    }
  }

  #handleClick(clickEvent) {
    const deleteButton = clickEvent.target.closest('.delete-button');
    if (deleteButton) {
      this.actions.removeRecurringCost(deleteButton.dataset.listName, deleteButton.dataset.costId);
      return;
    }

    const addButton = clickEvent.target.closest('[data-add-to-list]');
    if (addButton) {
      const listName = addButton.dataset.addToList;
      this.actions.addRecurringCost(listName);
      this.#selectLastRowName(listName);
    }
  }

  /** After adding a row, select its "New item" name so the user can type over it. */
  #selectLastRowName(listName) {
    const nameInputs = this.listElements[listName].querySelectorAll('.recurring-cost-name');
    nameInputs[nameInputs.length - 1]?.select();
  }

  /** Keeps the amount field as wide as its number, so the € sits right next to it. */
  #resizeAmountField(input) {
    if (input.dataset.field === 'amount') input.style.width = RecurringCostsView.#widthForValue(input.value);
  }

  static #widthForValue(value) {
    return `${Math.max(String(value).length, 1) + 0.5}ch`;
  }

  // ----- HTML -----

  #renderList(listName, costs) {
    const rows = costs.map((cost) => {
      const rowAttributes = `data-list-name="${listName}" data-cost-id="${escapeHtml(cost.id)}"`;
      return `
        <li class="recurring-cost-row">
          <input class="recurring-cost-name" value="${escapeHtml(cost.name)}" ${rowAttributes} data-field="name">
          <label class="recurring-cost-amount">€<input type="number" step="0.01" min="0" value="${cost.amount}"
                 ${rowAttributes} data-field="amount" style="width:${RecurringCostsView.#widthForValue(cost.amount)}"></label>
          <button class="delete-button" ${rowAttributes} title="${'Remove'}">✕</button>
        </li>`;
    });
    rows.push(`<li class="recurring-cost-add-row">
      <button class="text-button" data-add-to-list="${listName}">+ Add</button></li>`);
    return rows.join('');
  }
}
