import { useRef, useState, type KeyboardEvent } from 'react';

import { roundToCents } from '../../../shared/month/amounts.ts';
import { t } from '../i18n/translator.ts';
import { formatEuros, parseAmount } from '../utils/money.ts';

interface EditableAmountProps {
  amount: number;
  /** 0 is a valid amount (budgets, expected income); expenses and income need more than 0 */
  allowZero?: boolean;
  /** classes of the shown amount besides click-to-edit, for example "category-budget" */
  className?: string;
  onSave: (newAmount: number) => void;
}

/**
 * An amount such as "€24.00" that becomes a number field when clicked. Enter or clicking
 * away saves; Escape, an invalid number or an unchanged value show the amount again.
 */
export function EditableAmount({ amount, allowZero = false, className = '', onSave }: EditableAmountProps) {
  const [isEditing, setIsEditing] = useState(false);
  /** The field can lose focus while closing after Enter; this keeps it from saving twice. */
  const isFinished = useRef(false);

  if (!isEditing) {
    return (
      <span
        className={`click-to-edit ${className}`.trim()}
        title={t('common.clickToEdit')}
        onClick={() => {
          isFinished.current = false;
          setIsEditing(true);
        }}
      >
        {formatEuros(amount)}
      </span>
    );
  }

  const finish = (typedValue: string, shouldSave: boolean) => {
    if (isFinished.current) return;
    isFinished.current = true;
    setIsEditing(false);
    const newAmount = parseAmount(typedValue);
    const isValid = newAmount !== null && (allowZero ? newAmount >= 0 : newAmount > 0);
    if (shouldSave && isValid && roundToCents(newAmount) !== amount) onSave(roundToCents(newAmount));
  };

  return (
    <input
      type="number"
      step="0.01"
      min="0"
      defaultValue={amount}
      className="inline-number-input"
      // Focus and select the number as soon as the field appears, so typing replaces it.
      ref={(input) => {
        if (input && document.activeElement !== input) {
          input.focus();
          input.select();
        }
      }}
      onKeyDown={(keyEvent: KeyboardEvent<HTMLInputElement>) => {
        if (keyEvent.key === 'Enter') {
          keyEvent.preventDefault();
          finish(keyEvent.currentTarget.value, true);
        } else if (keyEvent.key === 'Escape') {
          finish(keyEvent.currentTarget.value, false);
        }
      }}
      onBlur={(blurEvent) => finish(blurEvent.currentTarget.value, true)}
    />
  );
}
