import { MonthRecord, type MonthData, type StoredMonthData } from '../../shared/month/month-record.ts';
import { closestSavedMonthKey } from '../../shared/month/month-validation.ts';

/** The parts of Durable Object storage this repository uses, so tests can pass a Map-based fake. */
export type DurableObjectMonthStorage = Pick<DurableObjectStorage, 'get' | 'put' | 'list'>;

const MONTH_KEY_PREFIX = 'month:';
const REVISION_KEY = 'revision';
const MAX_KEYS_PER_PUT = 128; // Durable Object storage limit

/**
 * Reads and writes one household's months in its Durable Object storage:
 *
 *   "month:2026-11" -> the month as saved (MonthData)
 *   "revision"      -> a number that goes up by one with every save
 *
 * The revision tells the page which of two answers is newer: answers can arrive in a
 * different order than the saves happened.
 */
export class DurableObjectMonthRepository {
  /** month keys, oldest first; null until first read */
  #monthKeys: string[] | null = null;
  #revision: number | null = null;

  constructor(private readonly storage: DurableObjectMonthStorage) {}

  async loadMonth(monthKey: string): Promise<MonthRecord | null> {
    const monthData = await this.storage.get<StoredMonthData>(storageKey(monthKey));
    return monthData ? new MonthRecord(monthData) : null;
  }

  /** The month, created and saved first if it doesn't exist yet (see createMonth). */
  async loadMonthOrCreateFromClosestMonth(monthKey: string): Promise<MonthRecord> {
    return (await this.loadMonth(monthKey)) ?? (await this.#createMonthFromClosestMonth(monthKey));
  }

  /** Saves the month and returns the new revision. */
  async saveMonth(monthRecord: MonthRecord): Promise<number> {
    const revision = (await this.latestRevision()) + 1;
    await this.storage.put({ [storageKey(monthRecord.monthKey)]: monthRecord.toJSON(), [REVISION_KEY]: revision });
    this.#revision = revision;
    const monthKeys = await this.savedMonthKeys();
    if (!monthKeys.includes(monthRecord.monthKey)) this.#monthKeys = [...monthKeys, monthRecord.monthKey].sort();
    return revision;
  }

  /** Every saved month key, oldest first. */
  async savedMonthKeys(): Promise<string[]> {
    if (this.#monthKeys === null) {
      const storedMonths = await this.storage.list({ prefix: MONTH_KEY_PREFIX });
      this.#monthKeys = [...storedMonths.keys()].map((key) => key.slice(MONTH_KEY_PREFIX.length)).sort();
    }
    return this.#monthKeys;
  }

  /** The revision of the latest save; 0 before the first one. */
  async latestRevision(): Promise<number> {
    this.#revision ??= (await this.storage.get<number>(REVISION_KEY)) ?? 0;
    return this.#revision;
  }

  /** Every saved month as stored, for a backup. */
  async loadAllMonths(): Promise<MonthData[]> {
    const storedMonths = await this.storage.list<MonthData>({ prefix: MONTH_KEY_PREFIX });
    return [...storedMonths.values()];
  }

  /** Saves these months, replacing any with the same month key. Returns the new revision. */
  async saveMonths(monthRecords: MonthRecord[]): Promise<number> {
    const revision = (await this.latestRevision()) + 1;
    for (let start = 0; start < monthRecords.length; start += MAX_KEYS_PER_PUT - 1) {
      const batch = monthRecords.slice(start, start + MAX_KEYS_PER_PUT - 1);
      await this.storage.put({
        ...Object.fromEntries(batch.map((monthRecord) => [storageKey(monthRecord.monthKey), monthRecord.toJSON()])),
        [REVISION_KEY]: revision,
      });
    }
    this.#revision = revision;
    this.#monthKeys = null; // re-read on next use
    return revision;
  }

  /** A new month copies categories, budgets and recurring costs from the closest saved month. */
  async #createMonthFromClosestMonth(monthKey: string): Promise<MonthRecord> {
    const templateMonthKey = closestSavedMonthKey(await this.savedMonthKeys(), monthKey);
    const templateMonth = templateMonthKey ? await this.loadMonth(templateMonthKey) : null;
    const newMonth = templateMonth
      ? MonthRecord.createFromTemplate(templateMonth, monthKey)
      : MonthRecord.createEmpty(monthKey);
    await this.saveMonth(newMonth);
    return newMonth;
  }
}

function storageKey(monthKey: string): string {
  return `${MONTH_KEY_PREFIX}${monthKey}`;
}
