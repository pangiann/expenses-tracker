import { ExpensesApp } from './ExpensesApp.js';
import { translator } from './i18n/Translator.js';
import { setMoneyLocale } from './utils/money.js';

// Translations load first, so every view draws in the chosen language from the start.
await translator.load();
translator.translatePage();
setMoneyLocale(translator.locale);

new ExpensesApp().start();
