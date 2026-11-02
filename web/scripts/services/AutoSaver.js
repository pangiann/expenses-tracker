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
    /** @type {Promise<void> | null} the save that is running right now */
    this.runningSave = null;
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

  /**
   * Saves the pending change right now, and returns once everything is written: also a save
   * the timer already started. (The Mac app relies on this before it stops the server.)
   */
  async flush() {
    if (this.hasPendingSave) {
      const monthRecord = this.pendingMonthRecord;
      this.#clearPending();
      await this.saveNow(monthRecord);
    } else if (this.runningSave) {
      await this.runningSave;
    }
  }

  async saveNow(monthRecord) {
    const previousSave = this.runningSave;
    const save = (async () => {
      await previousSave; // one save at a time, in order
      this.onStatusChange(SaveStatus.SAVING);
      try {
        await this.repository.save(monthRecord);
        this.onStatusChange(SaveStatus.SAVED);
      } catch (error) {
        console.error(error);
        this.onStatusChange(SaveStatus.FAILED);
      }
    })();
    this.runningSave = save;
    await save;
    if (this.runningSave === save) this.runningSave = null;
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
