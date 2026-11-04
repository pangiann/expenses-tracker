import { useRef, useState } from 'react';

import { t } from '../i18n/translator.ts';

interface EditableTextProps {
  text: string;
  maxLength: number;
  /** the element that shows the text */
  as?: 'h2' | 'span';
  /** classes of the shown text besides click-to-edit, for example "category-name" */
  className?: string;
  /** an error message when the new text isn't allowed, or null */
  validate: (newText: string) => string | null;
  onSave: (newText: string) => void;
}

/**
 * A text, such as a category name, that becomes a text field when clicked. Enter saves;
 * Escape, or clicking away without a valid change, shows the text again. When the new text
 * isn't allowed, the field stays open and the browser shows the reason next to it.
 */
export function EditableText({
  text,
  maxLength,
  as: Tag = 'span',
  className = '',
  validate,
  onSave,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  /** The field can lose focus while closing after Enter; this keeps it from saving twice. */
  const isFinished = useRef(false);

  if (!isEditing) {
    return (
      <Tag
        className={`click-to-edit ${className}`.trim()}
        title={t('common.clickToEdit')}
        onClick={() => {
          isFinished.current = false;
          setIsEditing(true);
        }}
      >
        {text}
      </Tag>
    );
  }

  const close = () => {
    isFinished.current = true;
    setIsEditing(false);
  };
  /** Saves a valid change and closes; returns the reason when the text isn't allowed. */
  const save = (newText: string): string | null => {
    if (!newText || newText === text) {
      close();
      return null;
    }
    const errorMessage = validate(newText);
    if (errorMessage) return errorMessage;
    close();
    onSave(newText);
    return null;
  };

  return (
    <input
      type="text"
      defaultValue={text}
      maxLength={maxLength}
      className="inline-text-input"
      ref={(input) => {
        if (input && document.activeElement !== input) {
          input.focus();
          input.select();
        }
      }}
      onInput={(inputEvent) => inputEvent.currentTarget.setCustomValidity('')}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === 'Escape') return close();
        if (keyEvent.key !== 'Enter') return;
        keyEvent.preventDefault();
        const errorMessage = save(keyEvent.currentTarget.value.trim());
        if (errorMessage) {
          keyEvent.currentTarget.setCustomValidity(errorMessage);
          keyEvent.currentTarget.reportValidity(); // the browser's own bubble next to the field
        }
      }}
      // Clicking away saves a valid name; an invalid one is dropped.
      onBlur={(blurEvent) => {
        if (isFinished.current) return;
        if (save(blurEvent.currentTarget.value.trim())) close();
      }}
    />
  );
}
