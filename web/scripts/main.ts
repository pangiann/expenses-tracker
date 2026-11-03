/**
 * The page's entry point (bundled into web/dist/main.js by `npm run build`): loads the
 * translations, then starts the month page.
 */
import { translator } from './i18n/translator.ts';
import { MonthPage } from './pages/month-page.ts';
import { setMoneyLocale } from './utils/money.ts';

// Translations load first, so every feature draws in the chosen language from the start.
await translator.load();
translator.translatePage();
setMoneyLocale(translator.locale);

void new MonthPage().start();
