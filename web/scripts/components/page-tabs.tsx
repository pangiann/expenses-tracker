import { t } from '../i18n/translator.ts';
import { pageHref, type PageName } from '../utils/page-route.ts';

/** "Month | Reports" at the top of the page content. Each is a link, so Back works as usual. */
export function PageTabs({ currentPage }: { currentPage: PageName }) {
  return (
    <nav className="page-tabs" aria-label={t('pages.label')}>
      {(['month', 'reports'] as const).map((page) => (
        <a
          key={page}
          href={pageHref(page)}
          className={`page-tab ${page === currentPage ? 'is-current' : ''}`.trim()}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {t(`pages.${page}`)}
        </a>
      ))}
    </nav>
  );
}
