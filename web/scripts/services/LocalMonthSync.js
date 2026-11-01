import { MonthRecord } from '../model/MonthRecord.js';
import { closestSavedMonthKey } from '../model/monthValidation.js';
import { AutoSaver } from './AutoSaver.js';
import { MonthRepository } from './MonthRepository.js';

/**
 * Backend for the local Python server (server/main.py) used by the Mac app.
 * Only one person edits, so it saves the whole month a moment after each change.
 *
 * Implements the same interface as CloudMonthSync; ExpensesApp doesn't know which one it has.
 */
export class LocalMonthSync {
  /**
   * @param {object} callbacks
   * @param {(monthRecord: MonthRecord, savedMonthKeys: string[]) => void} callbacks.onMonth
   * @param {(saveStatus: string) => void} callbacks.onSaveStatus
   */
  constructor({ onMonth, onSaveStatus }) { // onConnectionProblem isn't needed locally
    this.onMonth = onMonth;
    this.repository = new MonthRepository();
    this.autoSaver = new AutoSaver(this.repository, { onStatusChange: onSaveStatus });
    this.savedMonthKeys = [];
  }

  get startupErrorMessage() {
    return 'Could not load your data. Is the server running? Start it with <code>python3 server/main.py</code>';
  }

  /** Shows a month, creating it from the closest saved month if it doesn't exist yet. */
  async openMonth(monthKey) {
    await this.autoSaver.flush(); // finish saving the month we are leaving
    this.savedMonthKeys = await this.repository.listMonthKeys();
    if (this.savedMonthKeys.includes(monthKey)) {
      this.onMonth(await this.repository.load(monthKey), this.savedMonthKeys);
      return;
    }

    const templateMonthKey = closestSavedMonthKey(this.savedMonthKeys, monthKey);
    const newMonth = templateMonthKey
      ? MonthRecord.createFromTemplate(await this.repository.load(templateMonthKey), monthKey)
      : MonthRecord.createEmpty(monthKey);
    this.savedMonthKeys = [...this.savedMonthKeys, monthKey].sort();
    this.onMonth(newMonth, this.savedMonthKeys);
    await this.autoSaver.saveNow(newMonth);
  }

  /** The change is already applied to monthRecord; save the whole month shortly. */
  sendChange(monthRecord) {
    this.autoSaver.scheduleSave(monthRecord);
  }

  async flushPendingChanges() {
    await this.autoSaver.flush();
  }

  flushWhilePageCloses() {
    this.autoSaver.flushWhilePageCloses();
  }

  /** @returns {Promise<object[]>} every saved month in file format */
  async exportAllMonths() {
    await this.autoSaver.flush();
    const monthKeys = await this.repository.listMonthKeys();
    const monthRecords = await Promise.all(monthKeys.map((monthKey) => this.repository.load(monthKey)));
    return monthRecords.map((monthRecord) => monthRecord.toJSON());
  }

  /** @param {object[]} monthDataList  months in file format; each replaces the saved month */
  async importMonths(monthDataList) {
    await this.autoSaver.flush();
    for (const monthData of monthDataList) {
      await this.repository.save(new MonthRecord(monthData));
    }
  }
}
