import { t } from '../../i18n/translator.ts';
import { SaveStatus, type SaveStatusValue } from '../../utils/save-status.ts';

/** Each status's text, its symbol for phones (where the top bar has no room for the text) and its color class. */
const SAVE_STATUS_DISPLAY: Record<SaveStatusValue, { stringId: string; symbol: string; cssClass: string }> = {
  [SaveStatus.SAVED]: { stringId: 'status.saved', symbol: '✓', cssClass: 'is-saved' },
  [SaveStatus.SAVING]: { stringId: 'status.saving', symbol: '…', cssClass: '' },
  [SaveStatus.FAILED]: { stringId: 'status.failed', symbol: '!', cssClass: 'is-failed' },
  [SaveStatus.OFFLINE]: { stringId: 'status.offline', symbol: '!', cssClass: 'is-failed' },
};

/**
 * The save status in the top bar: Saved ✓, Saving…, Not saved, or Offline. Empty until the
 * first change. Phones show only the symbol, after the app's name; the text stays there for
 * screen readers and as the symbol's tooltip.
 */
export function SaveStatusPill({ saveStatus }: { saveStatus: SaveStatusValue | null }) {
  if (!saveStatus) return <span className="save-status"></span>;
  const { stringId, symbol, cssClass } = SAVE_STATUS_DISPLAY[saveStatus];
  return (
    <span className={`save-status ${cssClass}`} title={t(stringId)}>
      <span className="save-status-text">{t(stringId)}</span>
      <span className="save-status-symbol" aria-hidden="true">
        {symbol}
      </span>
    </span>
  );
}
