import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

import { BackupButtons } from '../features/backup/backup-buttons.tsx';
import { LanguagePicker } from '../features/language/language-picker.tsx';
import { SaveStatusPill } from '../features/status/save-status.tsx';
import { ThemePicker } from '../features/theme/theme-picker.tsx';
import { t } from '../i18n/translator.ts';
import { monthPageState } from '../sync/month-page-state.ts';

/**
 * The top bar of every page: the app's name, what the page puts in the middle (the month page
 * its ‹ month ›, the reports page its title), the save status, and the menus and buttons.
 */
export function TopBar({ middle }: { middle: ReactNode }) {
  const { saveStatus } = useSyncExternalStore(monthPageState.subscribe, monthPageState.getSnapshot);
  return (
    <header className="top-bar">
      <div className="brand">
        <img src="assets/icon.svg" alt="" className="brand-icon" /> <span>{t('app.title')}</span>
      </div>
      {middle}
      <div className="top-bar-actions">
        <SaveStatusPill saveStatus={saveStatus} />
        <ThemePicker />
        <LanguagePicker />
        <BackupButtons onImported={() => monthPageState.reloadShownMonth()} />
      </div>
    </header>
  );
}
