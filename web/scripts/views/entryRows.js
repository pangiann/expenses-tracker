import { t } from '../i18n/Translator.js';
import { escapeHtml } from '../utils/html.js';
import { formatEuros } from '../utils/money.js';
import { formatShortDate } from '../utils/monthKeys.js';

/**
 * The rows of a list of dated amounts: expenses in a category card, entries in the Income card.
 * The amount (class entry-amount) and the ✕ (class delete-button) carry data-entry-id.
 *
 * @param {{ id: string, date: string | null, description: string, amount: number }[]} entries
 * @param {string} [untitledStringId]  shown when an entry has no description
 */
export function renderEntryRows(entries, untitledStringId = 'common.noDescription') {
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
