import { useState } from 'react';

import { ignoreNonDigitKeys } from '../../components/amount-input.tsx';
import { t } from '../../i18n/translator.ts';
import { buildMonthKey, monthNames, parseMonthKey } from '../../utils/month-keys.ts';

const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2999;

interface AddMonthDialogProps {
  /** the month selected when the dialog opens; null keeps it closed */
  suggestedMonthKey: string | null;
  /** loads the chosen month; the server creates it */
  onOpenMonth: (monthKey: string) => void;
  onClose: () => void;
}

/** The "Add a month" dialog: pick a month and year, then open it. */
export function AddMonthDialog({ suggestedMonthKey, onOpenMonth, onClose }: AddMonthDialogProps) {
  return (
    <div className="dialog-backdrop" hidden={suggestedMonthKey === null}>
      {suggestedMonthKey && (
        // A new key for each opening starts the fields from the suggested month again.
        <AddMonthForm
          key={suggestedMonthKey}
          suggestedMonthKey={suggestedMonthKey}
          onOpenMonth={onOpenMonth}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function AddMonthForm({
  suggestedMonthKey,
  onOpenMonth,
  onClose,
}: AddMonthDialogProps & { suggestedMonthKey: string }) {
  const suggested = parseMonthKey(suggestedMonthKey);
  const [monthNumber, setMonthNumber] = useState(String(suggested.monthNumber));
  const [year, setYear] = useState(String(suggested.year));
  const [errorText, setErrorText] = useState('');

  return (
    <form
      className="card dialog"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const yearNumber = Number.parseInt(year, 10);
        if (!(yearNumber >= EARLIEST_YEAR && yearNumber <= LATEST_YEAR)) return setErrorText(t('addMonth.invalidYear'));
        onClose();
        onOpenMonth(buildMonthKey(yearNumber, Number(monthNumber)));
      }}
    >
      <h2>{t('addMonth.title')}</h2>
      <div className="dialog-fields">
        <select value={monthNumber} onChange={(changeEvent) => setMonthNumber(changeEvent.target.value)}>
          {monthNames().map((monthName, monthIndex) => (
            <option key={monthName} value={monthIndex + 1}>
              {monthName}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          min={EARLIEST_YEAR}
          max={LATEST_YEAR}
          value={year}
          onKeyDown={(keyEvent) => ignoreNonDigitKeys(keyEvent, false)}
          onChange={(changeEvent) => setYear(changeEvent.target.value)}
        />
      </div>
      <p className="dialog-hint">{t('addMonth.hint')}</p>
      <p className="dialog-error">{errorText}</p>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          {t('addMonth.cancel')}
        </button>
        <button type="submit" className="primary-button">
          {t('addMonth.submit')}
        </button>
      </div>
    </form>
  );
}
