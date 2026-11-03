import { t } from '../i18n/translator.ts';
import { getElement } from '../utils/html.ts';
import { SaveStatus } from '../utils/save-status.ts';

const SAVE_STATUS_DISPLAY = {
  [SaveStatus.SAVED]: { stringId: 'status.saved', cssClass: 'is-saved' },
  [SaveStatus.SAVING]: { stringId: 'status.saving', cssClass: '' },
  [SaveStatus.FAILED]: { stringId: 'status.failed', cssClass: 'is-failed' },
  [SaveStatus.OFFLINE]: { stringId: 'status.offline', cssClass: 'is-failed' },
};

/** The save status in the top bar and the red error banner under it. */
export class StatusView {
  constructor() {
    this.saveStatusElement = getElement('saveStatus');
    this.errorBanner = getElement('errorBanner');
  }

  showSaveStatus(saveStatus) {
    const display = SAVE_STATUS_DISPLAY[saveStatus];
    this.saveStatusElement.textContent = t(display.stringId);
    this.saveStatusElement.className = `save-status ${display.cssClass}`;
  }

  /** @param {string | null} text  shown as plain text; null hides the banner */
  showError(text) {
    this.errorBanner.textContent = text ?? '';
    this.errorBanner.hidden = text === null;
  }
}
