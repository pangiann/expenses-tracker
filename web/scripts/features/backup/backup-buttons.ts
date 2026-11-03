import { isMonthData } from '../../../../shared/month/month-validation.ts';
import { OfflineError } from '../../api/http.ts';
import * as monthsApi from '../../api/months-api.ts';
import { t } from '../../i18n/translator.ts';
import { getElement } from '../../utils/html.ts';
import { todayAsIsoDate } from '../../utils/month-keys.ts';

/**
 * Export and Import buttons in the top bar. A backup is one JSON file with every month.
 *   Export: GET /api/export, then download the file.
 *   Import: read the file, confirm, POST /api/import; the server replaces those months.
 */
export class BackupButtons {
  /** @param onImported  called after an import, so the page can load the month again */
  constructor(private readonly onImported: () => void) {
    const fileInput = getElement('importFileInput', HTMLInputElement);
    getElement('exportButton').addEventListener('click', () => void this.#exportBackup());
    getElement('importButton').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const chosenFile = fileInput.files?.[0];
      fileInput.value = ''; // choosing the same file again should still trigger an import
      if (chosenFile) void chosenFile.text().then((fileText) => this.#importBackup(fileText));
    });
  }

  async #exportBackup(): Promise<void> {
    let months;
    try {
      ({ months } = await monthsApi.exportMonths());
    } catch (error) {
      console.error(error);
      return alert(t('error.cloudUnreachable'));
    }
    const backup = { exportedAt: new Date().toISOString(), months };
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    downloadLink.download = `expenses-backup-${todayAsIsoDate()}.json`;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
  }

  async #importBackup(fileText: string): Promise<void> {
    const months = monthsInBackup(fileText);
    if (!months) return alert(t('backup.notABackup'));
    const monthList = months.map((monthData) => monthData.month).sort();
    const confirmation = t('backup.confirmImport', {
      count: months.length,
      first: monthList[0] ?? '',
      last: monthList.at(-1) ?? '',
    });
    if (!confirm(confirmation)) return;

    try {
      await monthsApi.importMonths(months);
    } catch (error) {
      console.error(error);
      return alert(error instanceof OfflineError ? t('error.cloudUnreachable') : t('backup.notABackup'));
    }
    this.onImported();
  }
}

/** The months in a backup file, or null when it isn't one. */
function monthsInBackup(fileText: string) {
  try {
    const { months } = JSON.parse(fileText) as { months?: unknown };
    return Array.isArray(months) && months.length > 0 && months.every(isMonthData) ? months : null;
  } catch {
    return null;
  }
}
