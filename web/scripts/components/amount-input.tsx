import type { ComponentProps, KeyboardEvent } from 'react';

/**
 * Browsers let a number field take "e", "+" and "-", because "1e3" and "-5" are numbers to
 * them. Amounts and years are never written that way, so those keys do nothing here.
 * @param allowDecimals  false for whole numbers such as a year: "." and "," do nothing either
 */
export function ignoreNonDigitKeys(keyEvent: KeyboardEvent<HTMLInputElement>, allowDecimals = true): void {
  const blockedKeys = allowDecimals ? ['e', 'E', '+', '-'] : ['e', 'E', '+', '-', '.', ','];
  if (blockedKeys.includes(keyEvent.key)) keyEvent.preventDefault();
}

/**
 * The field for an amount in euros: digits and one decimal separator, 0 or more, in cents.
 * It takes every prop of an <input>; onKeyDown still runs after the key filter. Phones show
 * the number pad with a decimal key (inputMode "decimal").
 */
export function AmountInput({ onKeyDown, ...inputProps }: ComponentProps<'input'>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      {...inputProps}
      onKeyDown={(keyEvent) => {
        ignoreNonDigitKeys(keyEvent);
        if (!keyEvent.defaultPrevented) onKeyDown?.(keyEvent);
      }}
    />
  );
}
