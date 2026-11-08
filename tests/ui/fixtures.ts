/**
 * What every UI test starts from: known months on the server, a page opened on the current
 * month, and short ways to find things on it. Import `test` and `expect` from here, not from
 * @playwright/test.
 */
import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type { MonthData } from '../../shared/month/month-record.ts';
import { MonthRecord } from '../../shared/month/month-record.ts';
import { SITE } from './test-site.ts';

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
const today = new Date();
/** The month the page opens on: today's, in this computer's time zone, like the page. */
export const THIS_MONTH = monthKeyOf(today);
export const LAST_MONTH = monthKeyOf(new Date(today.getFullYear(), today.getMonth() - 1, 1));
/** A date inside THIS_MONTH, for expenses: the 1st, so it is never in the future. */
export const FIRST_OF_THIS_MONTH = `${THIS_MONTH}-01`;

/** "November 2026": the month title the page shows in English. */
export function monthTitle(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/** The months every test starts with: last month and this month, each with a little in it. */
function startingMonths(): MonthData[] {
  const lastMonth = MonthRecord.createEmptyMonth(LAST_MONTH);
  lastMonth.addExpense({
    id: 'old-1',
    categoryId: 'lunch',
    amount: 9,
    description: 'old sandwich',
    date: `${LAST_MONTH}-02`,
  });

  const thisMonth = MonthRecord.createEmptyMonth(THIS_MONTH);
  thisMonth.setBudget('lunch', 80);
  thisMonth.setExpectedIncome(3000);
  thisMonth.addIncome({ id: 'salary', amount: 3000, description: 'salary', date: FIRST_OF_THIS_MONTH });
  thisMonth.addExpense({
    id: 'bread-1',
    categoryId: 'supermarket',
    amount: 2.5,
    description: 'bread',
    date: FIRST_OF_THIS_MONTH,
  });
  thisMonth.setRecurringCostAmount('fixed', 'fixed-1', 900);
  return [lastMonth.toJSON(), thisMonth.toJSON()];
}

/** The server, called like the page does (with this site's Origin, so edits are allowed). */
export class TestServer {
  constructor(private readonly request: APIRequestContext) {}

  /** Replaces last month and this month with the starting months. Other months stay. */
  async reset(): Promise<void> {
    const response = await this.request.post('/api/import', { data: { months: startingMonths() } });
    expect(response.status()).toBe(200);
  }

  async month(monthKey: string): Promise<MonthData> {
    const response = await this.request.get(`/api/months/${monthKey}`);
    expect(response.status()).toBe(200);
    return ((await response.json()) as { month: MonthData }).month;
  }

  /** Sends an edit as another device would, for example to change the month behind the page's back. */
  async send(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<number> {
    const response = await this.request.fetch(path, { method, data: body });
    return response.status();
  }
}

/** Short ways to reach the parts of the month page. */
export class MonthPage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.title).toHaveText(monthTitle(THIS_MONTH));
    await expect(this.page.getByText('salary')).toBeVisible();
  }

  get title(): Locator {
    return this.page.locator('.month-navigation h1');
  }

  get saveStatus(): Locator {
    return this.page.locator('.save-status');
  }

  /** Waits until the page says every edit is saved. */
  async expectSaved(): Promise<void> {
    await expect(this.saveStatus).toContainText('Saved');
  }

  get quickAdd(): Locator {
    return this.page.locator('.quick-add-form');
  }

  /** A category card, by the name it shows. */
  card(name: string): Locator {
    return this.page.locator('.category-cards .category-card').filter({
      has: this.page.locator('.category-name', { hasText: new RegExp(`^${name}$`) }),
    });
  }

  get incomeCard(): Locator {
    return this.page.locator('.income-card');
  }

  /** An expense or income row, by its description. */
  row(container: Locator, description: string): Locator {
    return container.locator('.expense-row').filter({ hasText: description });
  }

  get undoToast(): Locator {
    return this.page.locator('.undo-toast');
  }

  get errorBanner(): Locator {
    return this.page.locator('.error-banner');
  }

  /** The fixed costs' (first) or the subscriptions' (second) list in the side panel. */
  recurringList(which: 'fixed' | 'subscriptions'): Locator {
    return this.page.locator('.recurring-cost-list').nth(which === 'fixed' ? 0 : 1);
  }
}

export const test = base.extend<{ server: TestServer; monthPage: MonthPage }>({
  server: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: SITE, extraHTTPHeaders: { Origin: SITE } });
    const server = new TestServer(request);
    await server.reset();
    await use(server);
    await request.dispose();
  },
  monthPage: async ({ page, server }, use) => {
    void server; // the months are reset before the page opens
    await use(new MonthPage(page));
  },
});

export { expect };
