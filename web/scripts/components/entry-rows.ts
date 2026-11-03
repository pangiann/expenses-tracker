import { t } from '../i18n/translator.ts';
import { escapeHtml } from '../utils/html.ts';
import { formatEuros } from '../utils/money.ts';
import { formatShortDate } from '../utils/month-keys.ts';

export interface EntryRow {
  id: string;
  date?: string | null;
  description: string;
  amount: number;
}

/**
 * The rows of a list of dated amounts: expenses in a category card, entries in the Income card.
 * The amount (class entry-amount) and the ✕ (class delete-button) carry data-entry-id.
 * @param untitledStringId  shown when an entry has no description
 */
export function renderEntryRows(entries: readonly EntryRow[], untitledStringId = 'common.noDescription'): string {
  if (entries.length === 0) return `<div class="expense-list-empty">${escapeHtml(t('common.nothingYet'))}</div>`;
  return entries
    .map(
      (entry) => `
    <li class="expense-row">
      <span class="expense-date">${formatShortDate(entry.date)}</span>
      <span class="expense-description ${entry.description ? '' : 'is-empty'}">
        ${escapeHtml(entry.description || t(untitledStringId))}
      </span>
      <span class="click-to-edit entry-amount" data-entry-id="${escapeHtml(entry.id)}"
            title="${escapeHtml(t('common.clickToEdit'))}">${formatEuros(entry.amount)}</span>
      <button class="delete-button" data-entry-id="${escapeHtml(entry.id)}" title="${escapeHtml(t('common.delete'))}">✕</button>
    </li>`,
    )
    .join('');
}
