import { useRef } from 'react';

import { isMonthData } from '../../../../shared/month/month-validation.ts';
import { OfflineError } from '../../api/endpoint-http-client.ts';
import * as monthsApi from '../../api/months-api.ts';
import { t } from '../../i18n/translator.ts';
import { todayAsIsoDate } from '../../utils/month-keys.ts';

/**
 * Export and Import buttons in the top bar. A backup is one JSON file with every month.
 *   Export: GET /api/export, then download the file.
 *   Import: read the file, confirm, POST /api/import; the server replaces those months.
 * @param onImported  called after an import, so the page can load the month again
 */
export function BackupButtons({ onImported }: { onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);

  const importChosenFile = async () => {
    const chosenFile = fileInput.current?.files?.[0];
    if (fileInput.current) fileInput.current.value = ''; // choosing the same file again should still import it
    if (chosenFile && (await importBackup(await chosenFile.text()))) onImported();
  };

  return (
    <>
      <button className="secondary-button" title={t('backup.exportHint')} onClick={() => void exportBackup()}>
        {t('backup.export')}
      </button>
      <button className="secondary-button" title={t('backup.importHint')} onClick={() => fileInput.current?.click()}>
        {t('backup.import')}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={() => void importChosenFile()}
      />
    </>
  );
}

async function exportBackup(): Promise<void> {
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

/** @returns true when the months were imported */
async function importBackup(fileText: string): Promise<boolean> {
  const months = monthsInBackup(fileText);
  if (!months) {
    alert(t('backup.notABackup'));
    return false;
  }
  const monthList = months.map((monthData) => monthData.month).sort();
  const confirmation = t('backup.confirmImport', {
    count: months.length,
    first: monthList[0] ?? '',
    last: monthList.at(-1) ?? '',
  });
  if (!confirm(confirmation)) return false;

  try {
    await monthsApi.importMonths(months);
    return true;
  } catch (error) {
    console.error(error);
    alert(error instanceof OfflineError ? t('error.cloudUnreachable') : t('backup.notABackup'));
    return false;
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
