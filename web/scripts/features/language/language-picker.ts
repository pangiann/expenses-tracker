import { SUPPORTED_LANGUAGES, translator } from '../../i18n/translator.ts';
import { getElement } from '../../utils/html.ts';

/**
 * The EN / ΕΛ language picker in the top bar. Choosing a language saves it and reloads the
 * page; edits not yet sent wait in the outbox and survive the reload.
 */
export class LanguagePicker {
  constructor() {
    const languageSelect = getElement('languageSelect', HTMLSelectElement);
    languageSelect.innerHTML = Object.entries(SUPPORTED_LANGUAGES)
      .map(([language, { shortLabel }]) => `<option value="${language}">${shortLabel}</option>`)
      .join('');
    languageSelect.value = translator.language;
    languageSelect.addEventListener('change', () => {
      translator.saveLanguage(languageSelect.value);
      location.reload();
    });
  }
}
