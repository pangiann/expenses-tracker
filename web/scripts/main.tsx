/**
 * The page's entry point (bundled into web/dist/main.js by `npm run build`): loads the
 * translations, draws the month page with React, then connects to the server.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { t, translator } from './i18n/translator.ts';
import { MonthPage } from './pages/month-page.tsx';
import { monthPageStore } from './pages/month-page-store.ts';
import { setMoneyLocale } from './utils/money.ts';

// Translations load first, so every part of the page draws in the chosen language from the start.
await translator.load();
setMoneyLocale(translator.locale);
document.title = t('app.title');

const appElement = document.getElementById('app');
if (!appElement) throw new Error('index.html has no #app element');
createRoot(appElement).render(
  <StrictMode>
    <MonthPage />
  </StrictMode>,
);
void monthPageStore.start();
