import { SUPPORTED_LANGUAGES, t, translator } from '../../i18n/translator.ts';

/**
 * The EN / ΕΛ language picker in the top bar. Choosing a language saves it and reloads the
 * page; edits not yet sent wait in the outbox and survive the reload.
 */
export function LanguagePicker() {
  return (
    <select
      className="language-select"
      aria-label={t('language.label')}
      defaultValue={translator.language}
      onChange={(changeEvent) => {
        translator.saveLanguage(changeEvent.target.value);
        location.reload();
      }}
    >
      {Object.entries(SUPPORTED_LANGUAGES).map(([language, { shortLabel }]) => (
        <option key={language} value={language}>
          {shortLabel}
        </option>
      ))}
    </select>
  );
}
