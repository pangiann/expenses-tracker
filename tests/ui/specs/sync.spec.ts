/**
 * More than one device, and no connection: live updates, edits made offline, and an edit the
 * server refuses because someone else changed the month first.
 */
import { FIRST_OF_THIS_MONTH, MonthPage, THIS_MONTH, expect, test } from '../fixtures.ts';

test('an edit on one device shows on another without reloading', async ({ monthPage, browser, server }) => {
  void server;
  await monthPage.open();
  const otherDevice = await browser.newContext();
  const otherPage = new MonthPage(await otherDevice.newPage());
  await otherPage.open();

  await monthPage.quickAdd.getByPlaceholder('Amount €').fill('5');
  await monthPage.quickAdd.getByPlaceholder('Description').fill('shared lunch');
  await monthPage.quickAdd.locator('select').selectOption({ label: 'Lunch' });
  await monthPage.quickAdd.getByRole('button', { name: 'Add' }).click();

  await expect(otherPage.row(otherPage.card('Lunch'), 'shared lunch')).toContainText('€5.00');
  await otherDevice.close();
});

test('edits made offline show at once, wait, and are saved when the connection is back', async ({
  monthPage,
  context,
  server,
}) => {
  await monthPage.open();
  await context.setOffline(true);

  await monthPage.quickAdd.getByPlaceholder('Amount €').fill('7');
  await monthPage.quickAdd.getByPlaceholder('Description').fill('train ticket');
  await monthPage.quickAdd.locator('select').selectOption({ label: 'Transport' });
  await monthPage.quickAdd.getByRole('button', { name: 'Add' }).click();
  await expect(monthPage.row(monthPage.card('Transport'), 'train ticket')).toBeVisible(); // shown at once
  await expect(monthPage.saveStatus).toContainText('Offline'); // its request failed: it waits
  expect((await server.month(THIS_MONTH)).expenses).toHaveLength(1); // not on the server yet

  await context.setOffline(false);
  await monthPage.expectSaved();
  await expect
    .poll(async () => (await server.month(THIS_MONTH)).expenses.map((expense) => expense.description))
    .toContain('train ticket');
});

test('an edit the server refuses disappears, and the banner says why', async ({ monthPage, context, server }) => {
  await server.send('POST', `/api/months/${THIS_MONTH}/categories`, { id: 'trips', name: 'Trips' });
  await monthPage.open();
  const trips = monthPage.card('Trips');
  await expect(trips).toBeVisible();

  await context.setOffline(true);
  await trips.getByPlaceholder('Description').fill('ferry');
  await trips.getByPlaceholder('€').fill('30');
  await trips.getByRole('button', { name: '+' }).click();
  await expect(monthPage.row(trips, 'ferry')).toBeVisible();

  // Meanwhile someone else removes the category.
  expect(await server.send('DELETE', `/api/months/${THIS_MONTH}/categories/trips`)).toBe(200);
  await context.setOffline(false);

  await expect(monthPage.errorBanner).toContainText('its category no longer exists');
  await expect(trips).toHaveCount(0);
  expect((await server.month(THIS_MONTH)).expenses).toEqual([
    expect.objectContaining({ id: 'bread-1', date: FIRST_OF_THIS_MONTH }),
  ]);
});
