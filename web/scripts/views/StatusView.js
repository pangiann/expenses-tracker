import { getElement } from '../utils/html.js';
import { SaveStatus } from '../services/AutoSaver.js';

const SAVE_STATUS_DISPLAY = {
  [SaveStatus.SAVED]: { text: 'Saved ✓', cssClass: 'is-saved' },
  [SaveStatus.UNSAVED]: { text: 'Unsaved…', cssClass: '' },
  [SaveStatus.SAVING]: { text: 'Saving…', cssClass: '' },
  [SaveStatus.FAILED]: { text: 'Not saved', cssClass: 'is-failed' },
  [SaveStatus.OFFLINE]: { text: 'Offline, reconnecting…', cssClass: 'is-failed' },
};

/** The save status in the top bar and the red error banner under it. */
export class StatusView {
  constructor() {
    this.saveStatusElement = getElement('saveStatus');
    this.errorBanner = getElement('errorBanner');
  }

  showSaveStatus(saveStatus) {
    const display = SAVE_STATUS_DISPLAY[saveStatus];
    this.saveStatusElement.textContent = display.text;
    this.saveStatusElement.className = `save-status ${display.cssClass}`;
  }

  /** @param {string} trustedHtml  fixed app text only, never user input */
  showError(trustedHtml) {
    this.errorBanner.innerHTML = trustedHtml;
    this.errorBanner.hidden = false;
  }
}
