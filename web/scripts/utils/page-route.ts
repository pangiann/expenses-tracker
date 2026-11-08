/**
 * Which page is on screen, from the address bar: "#reports" is the reports page, anything else
 * the month page. Keeping it in the address means Back returns to the month, and a bookmark or
 * a home-screen icon can open the reports directly.
 */
export type PageName = 'month' | 'reports';

const REPORTS_HASH = '#reports';

export function currentPage(): PageName {
  return location.hash === REPORTS_HASH ? 'reports' : 'month';
}

/** The address of a page, for a link. */
export function pageHref(page: PageName): string {
  return page === 'reports' ? REPORTS_HASH : '#';
}

/** Calls the listener when the page changes; returns a function that stops it. */
export function subscribeToPageChanges(listener: () => void): () => void {
  addEventListener('hashchange', listener);
  return () => removeEventListener('hashchange', listener);
}

/** Shows a page, as if its link had been clicked. */
export function goToPage(page: PageName): void {
  location.hash = pageHref(page);
}
