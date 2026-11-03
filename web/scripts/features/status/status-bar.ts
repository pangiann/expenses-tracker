import { t } from '../../i18n/translator.ts';
import { getElement } from '../../utils/html.ts';
import { SaveStatus, type SaveStatusValue } from '../../utils/save-status.ts';

const SAVE_STATUS_DISPLAY: Record<SaveStatusValue, { stringId: string; cssClass: string }> = {
  [SaveStatus.SAVED]: { stringId: 'status.saved', cssClass: 'is-saved' },
  [SaveStatus.SAVING]: { stringId: 'status.saving', cssClass: '' },
  [SaveStatus.FAILED]: { stringId: 'status.failed', cssClass: 'is-failed' },
  [SaveStatus.OFFLINE]: { stringId: 'status.offline', cssClass: 'is-failed' },
};

/** The save status in the top bar and the red error banner under it. */
export class StatusBar {
  readonly #saveStatusElement = getElement('saveStatus');
  readonly #errorBanner = getElement('errorBanner');

  showSaveStatus(saveStatus: SaveStatusValue): void {
    const display = SAVE_STATUS_DISPLAY[saveStatus];
    this.#saveStatusElement.textContent = t(display.stringId);
    this.#saveStatusElement.className = `save-status ${display.cssClass}`;
  }

  /** @param text  shown as plain text; null hides the banner */
  showError(text: string | null): void {
    this.#errorBanner.textContent = text ?? '';
    this.#errorBanner.hidden = text === null;
  }
}
