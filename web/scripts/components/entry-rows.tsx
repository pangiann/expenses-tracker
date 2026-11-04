import { t } from '../i18n/translator.ts';
import { formatShortDate } from '../utils/month-keys.ts';
import { EditableAmount } from './editable-amount.tsx';

export interface Entry {
  id: string;
  date?: string | null;
  description: string;
  amount: number;
}

interface EntryRowsProps {
  entries: readonly Entry[];
  /** string id shown when an entry has no description */
  untitledStringId?: string;
  onChangeAmount: (entryId: string, newAmount: number) => void;
  onRemove: (entryId: string) => void;
}

/**
 * The rows of a list of dated amounts: the expenses in a category card, the entries in the
 * Income card. Click an amount to change it; ✕ removes the entry.
 */
export function EntryRows({
  entries,
  untitledStringId = 'common.noDescription',
  onChangeAmount,
  onRemove,
}: EntryRowsProps) {
  if (entries.length === 0) return <div className="expense-list-empty">{t('common.nothingYet')}</div>;
  return entries.map((entry) => (
    <li key={entry.id} className="expense-row">
      <span className="expense-date">{formatShortDate(entry.date)}</span>
      <span className={`expense-description ${entry.description ? '' : 'is-empty'}`}>
        {entry.description || t(untitledStringId)}
      </span>
      <EditableAmount
        amount={entry.amount}
        className="entry-amount"
        onSave={(newAmount) => onChangeAmount(entry.id, newAmount)}
      />
      <button className="delete-button" title={t('common.delete')} onClick={() => onRemove(entry.id)}>
        ✕
      </button>
    </li>
  ));
}
