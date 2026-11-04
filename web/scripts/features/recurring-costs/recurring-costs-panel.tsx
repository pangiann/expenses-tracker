import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { RecurringCostList, type RecurringCostListName } from '../../../../shared/month/categories.ts';
import type { MonthRecord, RecurringCost } from '../../../../shared/month/month-record.ts';
import * as recurringCostsApi from '../../api/recurring-costs-api.ts';
import { t } from '../../i18n/translator.ts';
import { formatEuros, parseAmount } from '../../utils/money.ts';

/**
 * The fixed costs and subscriptions panel. Every row's name and amount can be edited, rows
 * can be removed with ✕ and added with "+ Add"; each calls one recurring-cost endpoint.
 */
export function RecurringCostsPanel({ month }: { month: MonthRecord }) {
  return (
    <aside className="card recurring-costs-panel">
      <h2>{t('recurring.fixedCosts')}</h2>
      <RecurringCostRows month={month} listName={RecurringCostList.FIXED_COSTS} />
      <h3>{t('recurring.subscriptions')}</h3>
      <RecurringCostRows month={month} listName={RecurringCostList.SUBSCRIPTIONS} />
      <div className="recurring-costs-total">
        <span>{t('recurring.total')}</span> <span>{formatEuros(month.calculateTotals().recurringCostsTotal)}</span>
      </div>
    </aside>
  );
}

function RecurringCostRows({ month, listName }: { month: MonthRecord; listName: RecurringCostListName }) {
  const costs = month.recurringCostsIn(listName);
  const lastNameInput = useRef<HTMLInputElement>(null);
  /** The number of rows when "+ Add" was clicked; the new row's name is selected once it shows. */
  const rowCountWhenAdding = useRef<number | null>(null);

  useEffect(() => {
    if (rowCountWhenAdding.current !== null && costs.length > rowCountWhenAdding.current) {
      rowCountWhenAdding.current = null;
      lastNameInput.current?.select(); // the user types over "New item"
    }
  });

  return (
    <ul className="recurring-cost-list">
      {costs.map((cost, position) => (
        <RecurringCostRow
          key={cost.id}
          cost={cost}
          nameInput={position === costs.length - 1 ? lastNameInput : undefined}
          onRename={(name) => recurringCostsApi.renameRecurringCost(month.monthKey, listName, cost.id, name)}
          onChangeAmount={(amount) =>
            recurringCostsApi.changeRecurringCostAmount(month.monthKey, listName, cost.id, amount)
          }
          onRemove={() => recurringCostsApi.removeRecurringCost(month.monthKey, listName, cost.id)}
        />
      ))}
      <li className="recurring-cost-add-row">
        <button
          className="text-button"
          onClick={() => {
            rowCountWhenAdding.current = costs.length;
            recurringCostsApi.addRecurringCost(month.monthKey, listName, t('recurring.newItem'));
          }}
        >
          {t('recurring.add')}
        </button>
      </li>
    </ul>
  );
}

interface RecurringCostRowProps {
  cost: RecurringCost;
  nameInput?: RefObject<HTMLInputElement | null>;
  onRename: (name: string) => void;
  onChangeAmount: (amount: number) => void;
  onRemove: () => void;
}

/** One row: the name and the amount save when the field loses focus or on Enter, like a spreadsheet cell. */
function RecurringCostRow({ cost, nameInput, onRename, onChangeAmount, onRemove }: RecurringCostRowProps) {
  const [name, setName] = useState(cost.name);
  const [amount, setAmount] = useState(String(cost.amount));
  // When the saved values change (this edit's answer, or someone else's edit), the fields show them.
  const [shownCost, setShownCost] = useState(cost);
  if (shownCost.name !== cost.name || shownCost.amount !== cost.amount) {
    setShownCost(cost);
    setName(cost.name);
    setAmount(String(cost.amount));
  }
  const saveOnEnter = (keyEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyEvent.key === 'Enter') keyEvent.currentTarget.blur();
  };

  return (
    <li className="recurring-cost-row">
      <input
        ref={nameInput}
        className="recurring-cost-name"
        value={name}
        onChange={(changeEvent) => setName(changeEvent.target.value)}
        onKeyDown={saveOnEnter}
        onBlur={() => name !== cost.name && onRename(name)}
      />
      <label className="recurring-cost-amount">
        €
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          // As wide as the number, so the € sits right next to it.
          style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
          onChange={(changeEvent) => setAmount(changeEvent.target.value)}
          onKeyDown={saveOnEnter}
          onBlur={() => amount !== String(cost.amount) && onChangeAmount(parseAmount(amount) ?? 0)}
        />
      </label>
      <button className="delete-button" title={t('recurring.remove')} onClick={onRemove}>
        ✕
      </button>
    </li>
  );
}
