import { ExpensesApp } from './ExpensesApp.js';

const expensesApp = new ExpensesApp();

// The Mac app calls window.expensesApp.flushPendingSave() before quitting.
window.expensesApp = expensesApp;

expensesApp.start();
