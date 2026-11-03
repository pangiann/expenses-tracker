/**
 * Fills the local test site (`npm run dev`) with six months of made-up data, so you can
 * click around before deploying. Run it while `npm run dev` is running:
 *
 *   npm run seed
 *
 * It sends the same "import" message as the page's Import button, so the data goes
 * through the real Worker code. Months it creates replace the same months already there.
 * It only talks to localhost, where .dev.vars lets you in without signing in.
 */
import { DEFAULT_CATEGORIES, DEFAULT_FIXED_COST_NAMES } from '../web/scripts/config/categories.js';

const SITE = process.env.SEED_SITE ?? 'http://localhost:8787';
const MONTH_COUNT = 6;

const BUDGETS = {
  dinner: 150, lunch: 80, supermarket: 400, transport: 60, travel: 200, entertainment: 80,
  health: 60, home: 100, clothes: 80, gifts: 50, other: 50,
};
const DESCRIPTIONS = {
  dinner: ['pizza', 'sushi', 'tavern', 'burgers'],
  lunch: ['coffee', 'sandwich', 'salad', 'menu del día'],
  supermarket: ['groceries', 'market', 'bakery', 'fruit shop'],
  transport: ['metro card', 'taxi', 'bus', 'bike rental'],
  travel: ['flight', 'hotel', 'ferry', 'train'],
  entertainment: ['cinema', 'concert', 'museum', 'board game'],
  health: ['gym', 'pharmacy', 'haircut', 'dentist'],
  home: ['light bulbs', 'cleaning', 'plant', 'towels'],
  clothes: ['shoes', 'jacket', 't-shirt', 'jeans'],
  gifts: ['birthday present', 'flowers', 'wedding gift'],
  other: ['post office', 'phone case', 'parking'],
};
const FIXED_AMOUNTS = { Rent: 900, Internet: 35, Electricity: 70 };

function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(items) {
  return items[randomInteger(0, items.length - 1)];
}

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The last MONTH_COUNT months, oldest first, ending with the current month. */
function recentMonthStarts(today) {
  return Array.from({ length: MONTH_COUNT }, (_, index) =>
    new Date(today.getFullYear(), today.getMonth() - (MONTH_COUNT - 1 - index), 1));
}

function sampleMonth(monthStart, today) {
  const monthKey = monthKeyOf(monthStart);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lastDay = monthKey === monthKeyOf(today) ? today.getDate() : daysInMonth;
  const dateOn = (day) => `${monthKey}-${String(day).padStart(2, '0')}`;

  const expenses = Array.from({ length: Math.round(40 * lastDay / daysInMonth) }, () => {
    const category = pick(DEFAULT_CATEGORIES).id;
    const amount = randomInteger(300, BUDGETS[category] * 25) / 100;  // up to a quarter of the budget
    return { id: crypto.randomUUID(), date: dateOn(randomInteger(1, lastDay)), category,
             description: pick(DESCRIPTIONS[category]), amount };
  }).sort((first, second) => first.date.localeCompare(second.date));

  const incomeEntries = [{ id: crypto.randomUUID(), date: dateOn(1), description: 'salary', amount: 3200 }];
  if (Math.random() < 0.4) {
    incomeEntries.push({ id: crypto.randomUUID(), date: dateOn(Math.min(15, lastDay)),
                         description: 'side project', amount: randomInteger(100, 400) });
  }

  return {
    month: monthKey,
    income: { expected: 3500, entries: incomeEntries },
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    budgets: { ...BUDGETS },
    expenses,
    fixed: DEFAULT_FIXED_COST_NAMES.map((name, index) =>
      ({ id: `fixed-${index + 1}`, name, amount: FIXED_AMOUNTS[name] ?? 50 })),
    subscriptions: [
      { id: crypto.randomUUID(), name: 'Music', amount: 11 },
      { id: crypto.randomUUID(), name: 'Video', amount: 13 },
    ],
  };
}

/** Sends the months over the page's WebSocket and resolves when the Worker confirms. */
function importMonths(months) {
  const siteURL = new URL(SITE);
  if (siteURL.hostname !== 'localhost' && siteURL.hostname !== '127.0.0.1') {
    throw new Error(`Refusing to seed ${SITE}: only localhost is allowed.`);
  }
  const socketURL = `${siteURL.protocol === 'https:' ? 'wss' : 'ws'}://${siteURL.host}/api/live`;
  // The Worker accepts only connections that look like they come from its own page.
  const socket = new WebSocket(socketURL, { headers: { Origin: siteURL.origin } });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'import', months })));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'importDone') resolve(message.count);
      if (message.type === 'error') reject(new Error(message.message));
      if (message.type === 'importDone' || message.type === 'error') socket.close();
    });
    socket.addEventListener('error', () => reject(new Error(
      `Could not connect to ${socketURL}. Is \`npm run dev\` running, and does .dev.vars exist?`)));
  });
}

const today = new Date();
const months = recentMonthStarts(today).map((monthStart) => sampleMonth(monthStart, today));
const count = await importMonths(months);
console.log(`Imported ${count} months (${months[0].month} to ${months.at(-1).month}). Reload ${SITE}`);
