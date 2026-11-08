import { t } from '../../i18n/translator.ts';

/**
 * ‹ 2026 › above the report: moves between the years that have saved months.
 * @param savedYears  oldest first
 */
export function YearNavigation({
  year,
  savedYears,
  onChangeYear,
}: {
  year: number;
  savedYears: readonly number[];
  onChangeYear: (year: number) => void;
}) {
  const earlierYear = savedYears.filter((savedYear) => savedYear < year).at(-1);
  const laterYear = savedYears.find((savedYear) => savedYear > year);
  return (
    <nav className="year-navigation">
      <button
        className="round-button"
        title={t('nav.previousYear')}
        disabled={earlierYear === undefined}
        onClick={() => earlierYear !== undefined && onChangeYear(earlierYear)}
      >
        ‹
      </button>
      <h2>{year}</h2>
      <button
        className="round-button"
        title={t('nav.nextYear')}
        disabled={laterYear === undefined}
        onClick={() => laterYear !== undefined && onChangeYear(laterYear)}
      >
        ›
      </button>
    </nav>
  );
}
