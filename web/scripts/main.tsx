/**
 * The page's entry point (bundled into web/dist/main.js by `npm run build`): loads the
 * translations, draws the page with React (the month, or the reports), then connects to the server.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { t, translator } from './i18n/translator.ts';
import { App } from './pages/app.tsx';
import { monthPageState } from './sync/month-page-state.ts';
import { setMoneyLocale } from './utils/money.ts';

// Translations load first, so every part of the page draws in the chosen language from the start.
await translator.load();
setMoneyLocale(translator.locale);
document.title = t('app.title');

const appElement = document.getElementById('app');
if (!appElement) throw new Error('index.html has no #app element');
createRoot(appElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
void monthPageState.start();
