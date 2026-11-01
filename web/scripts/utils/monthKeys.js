/**
 * A month key is the "YYYY-MM" string used as the month file name (data/2026-09.json).
 * Keys sort chronologically as plain strings.
 */

function padToTwoDigits(number) {
  return String(number).padStart(2, '0');
}

/** Today's date in local time as "YYYY-MM-DD". */
export function todayAsIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${padToTwoDigits(today.getMonth() + 1)}-${padToTwoDigits(today.getDate())}`;
}

export function currentMonthKey() {
  return todayAsIsoDate().slice(0, 7);
}

export function buildMonthKey(year, monthNumber) {
  return `${year}-${padToTwoDigits(monthNumber)}`;
}

export function parseMonthKey(monthKey) {
  const [year, monthNumber] = monthKey.split('-').map(Number);
  return { year, monthNumber };
}

export function nextMonthKey(monthKey) {
  const { year, monthNumber } = parseMonthKey(monthKey);
  return monthNumber === 12 ? buildMonthKey(year + 1, 1) : buildMonthKey(year, monthNumber + 1);
}

/** "2026-09" -> "September 2026" */
export function formatMonthTitle(monthKey) {
  const { year, monthNumber } = parseMonthKey(monthKey);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Month names January to December. */
export function monthNames() {
  return Array.from({ length: 12 }, (_, monthIndex) =>
    new Date(2000, monthIndex, 1).toLocaleDateString('en-GB', { month: 'long' }));
}

/** First and last day of the month as "YYYY-MM-DD". */
export function monthDateRange(monthKey) {
  const { year, monthNumber } = parseMonthKey(monthKey);
  const lastDayOfMonth = new Date(year, monthNumber, 0).getDate();
  return { firstDay: `${monthKey}-01`, lastDay: `${monthKey}-${padToTwoDigits(lastDayOfMonth)}` };
}

/** Today if it falls inside the month, otherwise the month's first day. */
export function defaultExpenseDate(monthKey) {
  const today = todayAsIsoDate();
  const { firstDay, lastDay } = monthDateRange(monthKey);
  return today >= firstDay && today <= lastDay ? today : firstDay;
}

/** "2026-09-14" -> "14/09"; missing dates (imported data) show as "–". */
export function formatShortDate(isoDate) {
  if (!isoDate) return '–';
  const [, monthPart, dayPart] = isoDate.split('-');
  return `${dayPart}/${monthPart}`;
}
