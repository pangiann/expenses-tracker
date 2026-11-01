import { MonthRecord } from '../model/MonthRecord.js';

/**
 * Reads and writes month files through the local server (server/main.py):
 *   GET /api/months           -> ["2024-10", ..., "2026-11"]
 *   GET /api/months/2026-09   -> contents of data/2026-09.json
 *   PUT /api/months/2026-09   -> replaces data/2026-09.json
 */
export class MonthRepository {
  constructor(baseUrl = '/api/months') {
    this.baseUrl = baseUrl;
  }

  /** @returns {Promise<string[]>} saved month keys, oldest first */
  async listMonthKeys() {
    return this.#requestJson(this.baseUrl);
  }

  /** @returns {Promise<MonthRecord>} */
  async load(monthKey) {
    const monthData = await this.#requestJson(`${this.baseUrl}/${monthKey}`);
    return new MonthRecord(monthData);
  }

  /** @param {MonthRecord} monthRecord */
  async save(monthRecord) {
    await this.#requestJson(`${this.baseUrl}/${monthRecord.monthKey}`, this.#putRequest(monthRecord));
  }

  /** Save that the browser finishes even while the page is closing. Fire and forget. */
  saveWhilePageCloses(monthRecord) {
    fetch(`${this.baseUrl}/${monthRecord.monthKey}`, { ...this.#putRequest(monthRecord), keepalive: true });
  }

  #putRequest(monthRecord) {
    return {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(monthRecord),
    };
  }

  async #requestJson(url, requestOptions) {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`${requestOptions?.method ?? 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }
}
