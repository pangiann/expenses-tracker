/**
 * Turns a displayed text (for example a category name) into a text field in place.
 * Enter saves, Escape or clicking away without a valid change puts the original text back.
 * When the text is refused, the field stays open and the browser shows the reason.
 */
export class InlineTextEditor {
  /**
   * @param {HTMLElement} displayElement  the element showing the text
   * @param {object} options
   * @param {string} options.currentText
   * @param {number} options.maxLength
   * @param {(newText: string) => string | null} options.validate  returns an error message, or null when valid
   * @param {(newText: string) => void} options.onSave
   */
  static open(displayElement, { currentText, maxLength, validate, onSave }) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.maxLength = maxLength;
    input.className = 'inline-text-input';

    displayElement.replaceWith(input);
    input.focus();
    input.select();

    let isFinished = false;
    const close = () => {
      if (isFinished) return;
      isFinished = true;
      input.replaceWith(displayElement);
    };
    const save = () => {
      const newText = input.value.trim();
      if (!newText || newText === currentText) return close();
      const errorMessage = validate(newText);
      if (errorMessage) {
        input.setCustomValidity(errorMessage);
        input.reportValidity(); // the browser's own bubble next to the field
        return;
      }
      isFinished = true;
      onSave(newText); // the caller redraws, which removes the input
    };

    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('keydown', (keyEvent) => {
      if (keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        save();
      } else if (keyEvent.key === 'Escape') {
        close();
      }
    });
    // Clicking away saves a valid name; an invalid one is dropped.
    input.addEventListener('blur', () => {
      if (isFinished) return;
      const newText = input.value.trim();
      if (newText && newText !== currentText && !validate(newText)) {
        isFinished = true;
        onSave(newText);
      } else {
        close();
      }
    });
  }
}
