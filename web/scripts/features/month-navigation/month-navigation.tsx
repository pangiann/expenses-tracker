import { t } from '../../i18n/translator.ts';
import { currentMonthKey, formatMonthTitle, nextMonthKey } from '../../utils/month-keys.ts';

/**
 * The month title in the top bar, with ‹ › to move between saved months and + to add one.
 * @param monthKey  the month on screen, or null while loading
 * @param savedMonthKeys  every saved month, oldest first
 * @param onOpenMonth  loads a month from the server (the server creates one that doesn't exist yet)
 * @param onAddMonth  opens the "Add a month" dialog with this month selected
 */
export function MonthNavigation({
  monthKey,
  savedMonthKeys,
  onOpenMonth,
  onAddMonth,
}: {
  monthKey: string | null;
  savedMonthKeys: readonly string[];
  onOpenMonth: (monthKey: string) => void;
  onAddMonth: (suggestedMonthKey: string) => void;
}) {
  const position = monthKey ? savedMonthKeys.indexOf(monthKey) : -1;
  const previousMonthKey = position > 0 ? savedMonthKeys[position - 1] : undefined;
  const nextSavedMonthKey = position >= 0 ? savedMonthKeys[position + 1] : undefined;
  const latestMonthKey = savedMonthKeys.at(-1);

  return (
    <nav className="month-navigation">
      <button
        className="round-button"
        title={t('nav.previousMonth')}
        disabled={!previousMonthKey}
        onClick={() => previousMonthKey && onOpenMonth(previousMonthKey)}
      >
        ‹
      </button>
      <h1>{monthKey ? formatMonthTitle(monthKey) : t('app.loading')}</h1>
      <button
        className="round-button"
        title={t('nav.nextMonth')}
        disabled={!nextSavedMonthKey}
        onClick={() => nextSavedMonthKey && onOpenMonth(nextSavedMonthKey)}
      >
        ›
      </button>
      <button
        className="round-button add-month-button"
        title={t('nav.addMonth')}
        // Suggest the month after the latest saved one, or the current month when none is saved.
        onClick={() => onAddMonth(latestMonthKey ? nextMonthKey(latestMonthKey) : currentMonthKey())}
      >
        +
      </button>
    </nav>
  );
}
