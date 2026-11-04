import { t } from '../../i18n/translator.ts';
import { SaveStatus, type SaveStatusValue } from '../../utils/save-status.ts';

const SAVE_STATUS_DISPLAY: Record<SaveStatusValue, { stringId: string; cssClass: string }> = {
  [SaveStatus.SAVED]: { stringId: 'status.saved', cssClass: 'is-saved' },
  [SaveStatus.SAVING]: { stringId: 'status.saving', cssClass: '' },
  [SaveStatus.FAILED]: { stringId: 'status.failed', cssClass: 'is-failed' },
  [SaveStatus.OFFLINE]: { stringId: 'status.offline', cssClass: 'is-failed' },
};

/** The save status in the top bar: Saved ✓, Saving…, Not saved, or Offline. Empty until the first change. */
export function SaveStatusPill({ saveStatus }: { saveStatus: SaveStatusValue | null }) {
  if (!saveStatus) return <span className="save-status"></span>;
  const { stringId, cssClass } = SAVE_STATUS_DISPLAY[saveStatus];
  return <span className={`save-status ${cssClass}`}>{t(stringId)}</span>;
}
