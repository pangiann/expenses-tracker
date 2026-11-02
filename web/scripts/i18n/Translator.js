/**
 * Translations by string id, in the style of Panther: the code never contains display text,
 * only ids such as 'summary.earned'. Each language has one file in web/i18n/ that maps every
 * id to its text:
 *
 *   web/i18n/en.json   { "summary.earned": "Earned", ... }
 *   web/i18n/el.json   { "summary.earned": "Έσοδα", ... }
 *
 * English is the source language and the fallback: an id missing from el.json shows the
 * English text, and an id missing everywhere shows the id itself, so gaps are easy to spot.
 * test/translations.test.mjs checks that both files have exactly the same ids.
 *
 * Text can contain {placeholders}: t('categoryCard.left', { amount: '€5.00' }).
 */

export const SUPPORTED_LANGUAGES = Object.freeze({
  en: { locale: 'en-IE', shortLabel: 'EN' },
  el: { locale: 'el-GR', shortLabel: 'ΕΛ' },
});

const SOURCE_LANGUAGE = 'en';
const LANGUAGE_STORAGE_KEY = 'expenses.language';

class Translator {
  constructor() {
    this.language = SOURCE_LANGUAGE;
    this.strings = {};
    this.sourceStrings = {};
  }

  get locale() {
    return SUPPORTED_LANGUAGES[this.language].locale;
  }

  /** Loads the saved language (or the browser's), plus English as the fallback. */
  async load() {
    this.language = Translator.#preferredLanguage();
    this.sourceStrings = await Translator.#fetchStrings(SOURCE_LANGUAGE);
    this.strings = this.language === SOURCE_LANGUAGE
      ? this.sourceStrings
      : await Translator.#fetchStrings(this.language);
    document.documentElement.lang = this.language;
  }

  /** The text for a string id, with {placeholders} filled in. */
  translate(stringId, values = {}) {
    const text = this.strings[stringId] ?? this.sourceStrings[stringId] ?? stringId;
    return text.replace(/\{(\w+)\}/g, (placeholder, name) => (name in values ? String(values[name]) : placeholder));
  }

  /**
   * Translates the static page. Elements name their string ids in attributes:
   *   data-i18n="id"              text content
   *   data-i18n-placeholder="id"  placeholder attribute
   *   data-i18n-title="id"        title (tooltip) attribute
   *   data-i18n-aria-label="id"   aria-label attribute
   */
  translatePage(root = document) {
    for (const element of root.querySelectorAll('[data-i18n]')) {
      element.textContent = this.translate(element.dataset.i18n);
    }
    const attributeBindings = [
      ['i18nPlaceholder', 'placeholder'],
      ['i18nTitle', 'title'],
      ['i18nAriaLabel', 'aria-label'],
    ];
    for (const [datasetKey, attributeName] of attributeBindings) {
      const selector = `[data-${datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`;
      for (const element of root.querySelectorAll(selector)) {
        element.setAttribute(attributeName, this.translate(element.dataset[datasetKey]));
      }
    }
    document.title = this.translate('app.title');
  }

  /** Remembers the language for next time. The page reloads to show it everywhere. */
  saveLanguage(language) {
    if (!(language in SUPPORTED_LANGUAGES)) return;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* storage blocked (for example private browsing): the choice lasts until reload */
    }
  }

  static #preferredLanguage() {
    let savedLanguage = null;
    try {
      savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
    if (savedLanguage in SUPPORTED_LANGUAGES) return savedLanguage;
    const browserLanguage = (navigator.language ?? '').slice(0, 2).toLowerCase();
    return browserLanguage in SUPPORTED_LANGUAGES ? browserLanguage : SOURCE_LANGUAGE;
  }

  static async #fetchStrings(language) {
    try {
      const response = await fetch(`i18n/${language}.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Could not load translations for "${language}"`, error);
      return {};
    }
  }
}

export const translator = new Translator();

/** Shorthand used everywhere: t('summary.earned') */
export function t(stringId, values) {
  return translator.translate(stringId, values);
}

/** Display name of a spending category, for example t('category.dinner'). */
export function categoryName(category) {
  return t(`category.${category.key}`);
}

/** Month name in the nominative form used for titles: 1 -> "January" / "Ιανουάριος". */
export function monthName(monthNumber) {
  return t(`month.${monthNumber}`);
}
