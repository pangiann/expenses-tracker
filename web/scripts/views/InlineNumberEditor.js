import { roundToCents } from '../../../shared/month/amounts.ts';
import { parseAmount } from '../utils/money.js';

/**
 * Turns a displayed value (for example "€24.00") into a number field in place.
 * Enter or clicking away saves; Escape, an invalid number or an unchanged value
 * put the original text back.
 */
export class InlineNumberEditor {
  /**
   * @param {HTMLElement} displayElement  the element showing the value
   * @param {object} options
   * @param {number} options.currentValue
   * @param {boolean} [options.allowZero=false]
   * @param {(newValue: number) => void} options.onSave
   */
  static open(displayElement, { currentValue, allowZero = false, onSave }) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = currentValue;
    input.className = 'inline-number-input';

    displayElement.replaceWith(input);
    input.focus();
    input.select();

    let isFinished = false;
    const finish = (shouldSave) => {
      if (isFinished) return;
      isFinished = true;

      const newValue = parseAmount(input.value);
      const isValid = newValue !== null && (allowZero ? newValue >= 0 : newValue > 0);
      if (shouldSave && isValid && roundToCents(newValue) !== currentValue) {
        onSave(roundToCents(newValue)); // the caller redraws, which removes the input
      } else {
        input.replaceWith(displayElement);
      }
    };

    input.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        finish(true);
      } else if (keyEvent.key === 'Escape') {
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }
}
