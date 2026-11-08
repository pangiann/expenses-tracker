import { useState } from 'react';

import { t } from '../../i18n/translator.ts';
import { THEME_CHOICES, chooseTheme, currentThemeChoice, isThemeChoice } from '../../utils/theme-choice.ts';

/** What each choice shows in the menu: a symbol, then the word. */
const CHOICE_LABELS = {
  auto: { symbol: '◐', stringId: 'theme.auto' },
  light: { symbol: '☀︎', stringId: 'theme.light' },
  dark: { symbol: '☾', stringId: 'theme.dark' },
} as const;

/**
 * The Auto / Light / Dark menu in the top bar. The page switches at once, without a reload.
 * Phones have no room for the words, so there the menu shows only the chosen symbol: the
 * real menu lies invisible on top of it and still opens the full list (see responsive.css).
 */
export function ThemePicker() {
  const [choice, setChoice] = useState(currentThemeChoice);
  return (
    <span className="theme-picker">
      <span className="theme-picker-symbol" aria-hidden="true">
        {CHOICE_LABELS[choice].symbol}
      </span>
      <select
        className="language-select theme-select"
        aria-label={t('theme.label')}
        title={t('theme.label')}
        value={choice}
        onChange={(changeEvent) => {
          if (!isThemeChoice(changeEvent.target.value)) return;
          setChoice(changeEvent.target.value);
          chooseTheme(changeEvent.target.value);
        }}
      >
        {THEME_CHOICES.map((themeChoice) => (
          <option key={themeChoice} value={themeChoice}>
            {CHOICE_LABELS[themeChoice].symbol} {t(CHOICE_LABELS[themeChoice].stringId)}
          </option>
        ))}
      </select>
    </span>
  );
}
