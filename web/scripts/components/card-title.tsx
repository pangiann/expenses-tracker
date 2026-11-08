import { t } from '../i18n/translator.ts';
import { Icon, type IconName } from './icons.tsx';

interface CardTitleProps {
  icon: IconName;
  titleStringId: string;
  /** a short gray line under the title that says what the card is for */
  descriptionStringId: string;
}

/** A card's title with its icon, and a short description under it. */
export function CardTitle({ icon, titleStringId, descriptionStringId }: CardTitleProps) {
  return (
    <div className="card-title">
      <h2>
        <Icon name={icon} className="card-title-icon" />
        {t(titleStringId)}
      </h2>
      <p className="card-description">{t(descriptionStringId)}</p>
    </div>
  );
}
