/** On a phone (the "iphone" project: WebKit, touch, iPhone size). Tests here are tagged @phone. */
import { THIS_MONTH, expect, test } from '../fixtures.ts';

test.beforeEach(async ({ monthPage }) => {
  await monthPage.open();
});

test('adding an expense by tapping works, and amounts open the number pad @phone', async ({ monthPage, server }) => {
  const amount = monthPage.quickAdd.getByPlaceholder('Amount €');
  await expect(amount).toHaveAttribute('inputmode', 'decimal');
  await amount.tap();
  await amount.fill('4');
  await monthPage.quickAdd.getByPlaceholder('Description').fill('tapped coffee');
  await monthPage.quickAdd.locator('select').selectOption({ label: 'Lunch' });
  await monthPage.quickAdd.getByRole('button', { name: 'Add' }).tap();
  await expect(monthPage.row(monthPage.card('Lunch'), 'tapped coffee')).toBeVisible();
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).expenses).toHaveLength(2);
});

test('the save status is a symbol after the app name, the full text kept for screen readers @phone', async ({
  monthPage,
}) => {
  await expect(monthPage.page.locator('.save-status-symbol')).toBeVisible();
  await expect(monthPage.page.locator('.save-status-text')).toHaveText('Saved ✓'); // in the page, out of sight
});

test('the ✕ on an expense is always shown and easy to tap @phone', async ({ monthPage }) => {
  const remove = monthPage.row(monthPage.card('Supermarket'), 'bread').getByTitle('Delete');
  await expect(remove).toBeVisible();
  await remove.tap();
  await expect(monthPage.undoToast).toBeVisible();
});
