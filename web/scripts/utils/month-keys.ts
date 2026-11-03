/**
 * A month key is the "YYYY-MM" string used as the month file name (data/2026-09.json).
 * Keys sort chronologically as plain strings.
 */
import { monthName } from '../i18n/translator.ts';

function padToTwoDigits(number: number): string {
  return String(number).padStart(2, '0');
}

/** Today's date in local time as "YYYY-MM-DD". */
export function todayAsIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${padToTwoDigits(today.getMonth() + 1)}-${padToTwoDigits(today.getDate())}`;
}

export function currentMonthKey(): string {
  return todayAsIsoDate().slice(0, 7);
}

export function buildMonthKey(year: number, monthNumber: number): string {
  return `${year}-${padToTwoDigits(monthNumber)}`;
}

export function parseMonthKey(monthKey: string): { year: number; monthNumber: number } {
  const [year = 0, monthNumber = 0] = monthKey.split('-').map(Number);
  return { year, monthNumber };
}

export function nextMonthKey(monthKey: string): string {
  const { year, monthNumber } = parseMonthKey(monthKey);
  return monthNumber === 12 ? buildMonthKey(year + 1, 1) : buildMonthKey(year, monthNumber + 1);
}

/** "2026-09" -> "September 2026" / "Σεπτέμβριος 2026" */
export function formatMonthTitle(monthKey: string): string {
  const { year, monthNumber } = parseMonthKey(monthKey);
  return `${monthName(monthNumber)} ${year}`;
}

/** Month names January to December, in the page language. */
export function monthNames(): string[] {
  return Array.from({ length: 12 }, (_, monthIndex) => monthName(monthIndex + 1));
}

/** First and last day of the month as "YYYY-MM-DD". */
export function monthDateRange(monthKey: string): { firstDay: string; lastDay: string } {
  const { year, monthNumber } = parseMonthKey(monthKey);
  const lastDayOfMonth = new Date(year, monthNumber, 0).getDate();
  return { firstDay: `${monthKey}-01`, lastDay: `${monthKey}-${padToTwoDigits(lastDayOfMonth)}` };
}

/** Today if it falls inside the month, otherwise the month's first day. */
export function defaultExpenseDate(monthKey: string): string {
  const today = todayAsIsoDate();
  const { firstDay, lastDay } = monthDateRange(monthKey);
  return today >= firstDay && today <= lastDay ? today : firstDay;
}

/** "2026-09-14" -> "14/09"; missing dates (imported data) show as "–". */
export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '–';
  const [, monthPart, dayPart] = isoDate.split('-');
  return `${dayPart}/${monthPart}`;
}
