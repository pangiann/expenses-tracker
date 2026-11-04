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

import type { Category } from '../../../shared/month/categories.ts';

export const SUPPORTED_LANGUAGES = Object.freeze({
  en: { locale: 'en-IE', shortLabel: 'EN' },
  el: { locale: 'el-GR', shortLabel: 'ΕΛ' },
});

export type Language = keyof typeof SUPPORTED_LANGUAGES;
type Strings = Record<string, string>;
/** Values for {placeholders} in a text. */
export type TextValues = Record<string, string | number>;

const SOURCE_LANGUAGE: Language = 'en';
const LANGUAGE_STORAGE_KEY = 'expenses.language';

class Translator {
  language: Language = SOURCE_LANGUAGE;
  #strings: Strings = {};
  #sourceStrings: Strings = {};

  get locale(): string {
    return SUPPORTED_LANGUAGES[this.language].locale;
  }

  /** Loads the saved language (or the browser's), plus English as the fallback. */
  async load(): Promise<void> {
    this.language = Translator.#preferredLanguage();
    this.#sourceStrings = await Translator.#fetchStrings(SOURCE_LANGUAGE);
    this.#strings =
      this.language === SOURCE_LANGUAGE ? this.#sourceStrings : await Translator.#fetchStrings(this.language);
    document.documentElement.lang = this.language;
  }

  /** The text for a string id, with {placeholders} filled in. */
  translate(stringId: string, values: TextValues = {}): string {
    const text = this.#strings[stringId] ?? this.#sourceStrings[stringId] ?? stringId;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(values[name] ?? placeholder));
  }

  /** Remembers the language for next time. The page reloads to show it everywhere. */
  saveLanguage(language: string): void {
    if (!isLanguage(language)) return;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* storage blocked (for example private browsing): the choice lasts until reload */
    }
  }

  static #preferredLanguage(): Language {
    let savedLanguage: string | null = null;
    try {
      savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
    if (savedLanguage !== null && isLanguage(savedLanguage)) return savedLanguage;
    const browserLanguage = navigator.language.slice(0, 2).toLowerCase();
    return isLanguage(browserLanguage) ? browserLanguage : SOURCE_LANGUAGE;
  }

  static async #fetchStrings(language: Language): Promise<Strings> {
    try {
      const response = await fetch(`i18n/${language}.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as Strings;
    } catch (error) {
      console.error(`Could not load translations for "${language}"`, error);
      return {};
    }
  }
}

export const translator = new Translator();

/** Shorthand used everywhere: t('summary.earned') */
export function t(stringId: string, values?: TextValues): string {
  return translator.translate(stringId, values);
}

/** Display name of a category: the name someone typed, or the translation of a default one. */
export function categoryName(category: Category): string {
  return category.name ?? t(category.nameId ?? '');
}

/** Month name in the nominative form used for titles: 1 -> "January" / "Ιανουάριος". */
export function monthName(monthNumber: number): string {
  return t(`month.${monthNumber}`);
}

export function isLanguage(language: string): language is Language {
  return language in SUPPORTED_LANGUAGES;
}
