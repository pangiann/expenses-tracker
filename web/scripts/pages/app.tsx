import { useSyncExternalStore } from 'react';

import { currentPage, subscribeToPageChanges } from '../utils/page-route.ts';
import { MonthPage } from './month-page.tsx';
import { ReportsPage } from './reports-page.tsx';

/** The page the address bar asks for: the month page, or the reports page at "#reports". */
export function App() {
  const page = useSyncExternalStore(subscribeToPageChanges, currentPage);
  return page === 'reports' ? <ReportsPage /> : <MonthPage />;
}
