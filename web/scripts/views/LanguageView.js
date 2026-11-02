import { SUPPORTED_LANGUAGES, translator } from '../i18n/Translator.js';
import { getElement } from '../utils/html.js';

/** The EN / ΕΛ language picker in the top bar. */
export class LanguageView {
  /**
   * @param {object} actions
   * @param {(language: string) => void} actions.changeLanguage
   */
  constructor(actions) {
    const languageSelect = getElement('languageSelect');
    languageSelect.innerHTML = Object.entries(SUPPORTED_LANGUAGES)
      .map(([language, { shortLabel }]) => `<option value="${language}">${shortLabel}</option>`)
      .join('');
    languageSelect.value = translator.language;
    languageSelect.addEventListener('change', () => actions.changeLanguage(languageSelect.value));
  }
}
