/**
 * Keeps this device's unconfirmed changes in the browser's localStorage, so an edit made
 * while offline survives closing the tab or the browser. The next time the page opens, the
 * changes are sent again; the server applies each one only once.
 */
const STORAGE_KEY = 'expenses.pendingChanges';

export class PendingChangeStore {
  /** @returns {{ changeId: string, monthKey: string, change: object }[]} */
  static load() {
    try {
      const storedChanges = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(storedChanges) ? storedChanges.filter(PendingChangeStore.#isPendingChange) : [];
    } catch {
      return []; // storage blocked or corrupt: start empty
    }
  }

  static save(pendingChanges) {
    try {
      if (pendingChanges.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChanges));
    } catch {
      /* storage blocked (for example private browsing): changes live only in memory */
    }
  }

  static #isPendingChange(entry) {
    return typeof entry?.changeId === 'string' && typeof entry?.monthKey === 'string'
      && typeof entry?.change === 'object' && entry.change !== null;
  }
}
