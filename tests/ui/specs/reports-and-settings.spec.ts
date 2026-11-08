import { LAST_MONTH, THIS_MONTH, expect, monthTitle, test } from '../fixtures.ts';

test('the Reports tab shows the year, and a month in its table opens that month', async ({ monthPage }) => {
  await monthPage.open();
  await monthPage.page.locator('.page-tab', { hasText: 'Reports' }).click();
  await expect(monthPage.page).toHaveURL(/#reports$/);
  await expect(monthPage.page.locator('.year-navigation h2')).toHaveText(THIS_MONTH.slice(0, 4));
  await expect(monthPage.page.locator('.summary-card').first()).toContainText('Earned');

  const months = monthPage.page.locator('.month-table tbody tr');
  await expect(months.first()).toContainText(monthTitle(THIS_MONTH));
  // Last month is in the same year except in January; the table then shows only this month.
  if (LAST_MONTH.slice(0, 4) === THIS_MONTH.slice(0, 4)) {
    await months
      .filter({ hasText: monthTitle(LAST_MONTH) })
      .getByRole('button')
      .click();
    await expect(monthPage.title).toHaveText(monthTitle(LAST_MONTH));
    await monthPage.page.goBack();
    await expect(monthPage.page.locator('.month-table')).toBeVisible();
  }
  await monthPage.page.locator('.page-tab', { hasText: 'Month' }).click();
  await expect(monthPage.quickAdd).toBeVisible();
});

test('the page is light by default; Dark switches at once and is remembered', async ({ monthPage }) => {
  await monthPage.page.emulateMedia({ colorScheme: 'dark' }); // even on a device in dark mode
  await monthPage.open();
  const html = monthPage.page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await monthPage.page.locator('.theme-select').selectOption('dark');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await monthPage.page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await monthPage.page.locator('.theme-select').selectOption('auto');
  await expect(html).toHaveAttribute('data-theme', 'dark'); // follows the device
});

test('the language picker switches the page to Greek', async ({ monthPage }) => {
  await monthPage.open();
  await monthPage.page.getByLabel('Language').selectOption('el');
  await expect(monthPage.page.locator('.quick-add h2')).toHaveText('Νέο έξοδο');
  await expect(monthPage.page.locator('html')).toHaveAttribute('lang', 'el');
});
