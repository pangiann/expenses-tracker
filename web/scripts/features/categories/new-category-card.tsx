import { useState } from 'react';

import { MAX_CATEGORY_NAME_LENGTH } from '../../../../shared/month/categories.ts';
import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as categoriesApi from '../../api/categories-api.ts';
import { t } from '../../i18n/translator.ts';
import { isNameShown } from './category-card.tsx';

/** The "New category" card after the category cards: adds a category (POST /api/months/:month/categories). */
export function NewCategoryCard({ month }: { month: MonthRecord }) {
  const [name, setName] = useState('');
  const [errorText, setErrorText] = useState('');
  return (
    <form
      className="card new-category-card new-category-form"
      autoComplete="off"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;
        if (isNameShown(month, trimmedName)) return setErrorText(t('categories.duplicateName'));
        categoriesApi.addCategory(month.monthKey, { name: trimmedName });
        setName('');
        setErrorText('');
      }}
    >
      <h2>{t('categories.newTitle')}</h2>
      <div className="new-category-fields">
        <input
          name="name"
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          placeholder={t('categories.namePlaceholder')}
          required
          value={name}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
        />
        <button type="submit" className="primary-button">
          {t('common.add')}
        </button>
      </div>
      <p className="new-category-error" aria-live="polite">
        {errorText}
      </p>
    </form>
  );
}
