import { LAST_MONTH, THIS_MONTH, expect, monthTitle, test } from '../fixtures.ts';

test.beforeEach(async ({ monthPage }) => {
  await monthPage.open();
});

test('‹ and › move between saved months', async ({ monthPage }) => {
  await monthPage.page.getByTitle('Previous month').click();
  await expect(monthPage.title).toHaveText(monthTitle(LAST_MONTH));
  await expect(monthPage.page.getByText('old sandwich')).toBeVisible();

  await monthPage.page.getByTitle('Next month').click();
  await expect(monthPage.title).toHaveText(monthTitle(THIS_MONTH));
  await expect(monthPage.page.getByText('salary')).toBeVisible();
});

test('"Add a month" opens a month the household did not have, copying the budgets', async ({ monthPage, server }) => {
  await monthPage.page.getByTitle('Add a month').click();
  const dialog = monthPage.page.locator('.dialog-backdrop');
  await dialog.locator('select').selectOption({ label: 'January' });
  await dialog.locator('input').fill('2031');
  await dialog
    .locator('form')
    .getByRole('button', { name: /open|add/i })
    .click();

  await expect(monthPage.title).toHaveText('January 2031');
  await expect(monthPage.card('Lunch')).toContainText('Budget €80.00');
  const january = await server.month('2031-01');
  expect(january.expenses).toEqual([]);
});
