export const SaveStatus = Object.freeze({
  SAVED: 'saved',
  UNSAVED: 'unsaved',
  SAVING: 'saving',
  FAILED: 'failed',
  OFFLINE: 'offline',
});

/**
 * Saves a month shortly after the last change, so a burst of edits becomes one write.
 * Used by the local (file) backend only.
 */
export class AutoSaver {
  /**
   * @param {import('./MonthRepository.js').MonthRepository} repository
   * @param {object} options
   * @param {number} options.delayInMilliseconds  wait this long after the last change
   * @param {(status: string) => void} options.onStatusChange  receives a SaveStatus value
   */
  constructor(repository, { delayInMilliseconds = 400, onStatusChange = () => {} } = {}) {
    this.repository = repository;
    this.delayInMilliseconds = delayInMilliseconds;
    this.onStatusChange = onStatusChange;
    this.pendingMonthRecord = null;
    this.pendingTimer = null;
  }

  get hasPendingSave() {
    return this.pendingMonthRecord !== null;
  }

  scheduleSave(monthRecord) {
    this.pendingMonthRecord = monthRecord;
    clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => this.flush(), this.delayInMilliseconds);
    this.onStatusChange(SaveStatus.UNSAVED);
  }

  /** Saves the pending change right now, if there is one. */
  async flush() {
    if (!this.hasPendingSave) return;
    const monthRecord = this.pendingMonthRecord;
    this.#clearPending();
    await this.saveNow(monthRecord);
  }

  async saveNow(monthRecord) {
    this.onStatusChange(SaveStatus.SAVING);
    try {
      await this.repository.save(monthRecord);
      this.onStatusChange(SaveStatus.SAVED);
    } catch (error) {
      console.error(error);
      this.onStatusChange(SaveStatus.FAILED);
    }
  }

  /** Used when the page is closing: no time to wait for an answer. */
  flushWhilePageCloses() {
    if (!this.hasPendingSave) return;
    this.repository.saveWhilePageCloses(this.pendingMonthRecord);
    this.#clearPending();
  }

  #clearPending() {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pendingMonthRecord = null;
  }
}
