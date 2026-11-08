/**
 * Light or dark: "auto" follows the device. web/theme-before-paint.js applies the choice
 * before the page is drawn and whenever it changes; this file only reads and saves it.
 */

export const THEME_CHOICES = ['auto', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

const THEME_STORAGE_KEY = 'expenses.theme'; // the same key as in web/theme-before-paint.js

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return THEME_CHOICES.includes(value as ThemeChoice);
}

/** The saved choice, or "auto" when none is saved. */
export function currentThemeChoice(): ThemeChoice {
  try {
    const choice = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(choice) ? choice : 'auto';
  } catch {
    return 'auto'; // storage blocked
  }
}

/** Saves the choice; the page switches at once, without a reload. */
export function chooseTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage blocked, for example private browsing: the page stays on auto */
  }
  dispatchEvent(new Event('expenses:theme-chosen'));
}
