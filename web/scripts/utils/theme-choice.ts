/**
 * Light or dark: "auto" follows the device. Light is the default, until someone chooses.
 * web/theme-before-paint.js applies the choice before the page is drawn and whenever it changes;
 * this file only reads and saves it.
 */

export const THEME_CHOICES = ['auto', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** The theme when nobody chose one (the same as in web/theme-before-paint.js). */
const DEFAULT_THEME_CHOICE: ThemeChoice = 'light';

const THEME_STORAGE_KEY = 'expenses.theme'; // the same key as in web/theme-before-paint.js

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice);
}

/** The saved choice, or the default when none is saved. */
export function currentThemeChoice(): ThemeChoice {
  try {
    const choice = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(choice) ? choice : DEFAULT_THEME_CHOICE;
  } catch {
    return DEFAULT_THEME_CHOICE; // storage blocked
  }
}

/** Saves the choice; the page switches at once, without a reload. */
export function chooseTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice); // "auto" too, since it isn't the default
  } catch {
    /* storage blocked, for example private browsing: the page stays on the default */
  }
  dispatchEvent(new Event('expenses:theme-chosen'));
}
