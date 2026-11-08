import { FIRST_OF_THIS_MONTH, THIS_MONTH, expect, test } from '../fixtures.ts';

test.beforeEach(async ({ monthPage }) => {
  await monthPage.open();
});

test('the quick add bar adds an expense, which the server saves', async ({ monthPage, server }) => {
  await monthPage.quickAdd.getByPlaceholder('Amount €').fill('12.34');
  await monthPage.quickAdd.getByPlaceholder('Description').fill('coffee with Anna');
  await monthPage.quickAdd.locator('select').selectOption({ label: 'Lunch' });
  await monthPage.quickAdd.getByRole('button', { name: 'Add' }).click();

  await expect(monthPage.row(monthPage.card('Lunch'), 'coffee with Anna')).toContainText('€12.34');
  await expect(monthPage.quickAdd.getByPlaceholder('Amount €')).toHaveValue(''); // ready for the next one
  await monthPage.expectSaved();
  const saved = await server.month(THIS_MONTH);
  expect(saved.expenses).toContainEqual(
    expect.objectContaining({ category: 'lunch', amount: 12.34, description: 'coffee with Anna' }),
  );
});

test('a category card adds an expense to itself', async ({ monthPage }) => {
  const card = monthPage.card('Supermarket');
  await card.getByPlaceholder('Description').fill('milk');
  await card.getByPlaceholder('€').fill('1.80');
  await card.getByRole('button', { name: '+' }).click();
  await expect(monthPage.row(card, 'milk')).toContainText('€1.80');
  await expect(card.locator('.category-card-spent')).toHaveText('€4.30'); // bread 2.50 + milk 1.80
});

test('an amount without a number is not sent', async ({ monthPage, server }) => {
  await monthPage.quickAdd.getByPlaceholder('Description').fill('nothing');
  await monthPage.quickAdd.getByRole('button', { name: 'Add' }).click();
  await expect(monthPage.quickAdd.getByPlaceholder('Description')).toHaveValue('nothing'); // kept, to fix
  expect((await server.month(THIS_MONTH)).expenses).toHaveLength(1);
});

test('clicking an amount changes it', async ({ monthPage, server }) => {
  const bread = monthPage.row(monthPage.card('Supermarket'), 'bread');
  await bread.locator('.entry-amount').click();
  const input = bread.locator('input');
  await input.fill('3.10');
  await input.press('Enter');
  await expect(bread).toContainText('€3.10');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).expenses[0]!.amount).toBe(3.1);
});

test('a removed expense comes back with Undo', async ({ monthPage, server }) => {
  const card = monthPage.card('Supermarket');
  await monthPage.row(card, 'bread').hover();
  await monthPage.row(card, 'bread').getByTitle('Delete').click();
  await expect(monthPage.row(card, 'bread')).toHaveCount(0);
  await expect(monthPage.undoToast).toContainText('Expense removed (€2.50)');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).expenses).toHaveLength(0);

  await monthPage.undoToast.getByRole('button', { name: 'Undo' }).click();
  await expect(monthPage.row(card, 'bread')).toContainText('€2.50');
  await expect(monthPage.undoToast).toHaveCount(0);
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).expenses).toEqual([
    { id: 'bread-1', category: 'supermarket', amount: 2.5, description: 'bread', date: FIRST_OF_THIS_MONTH },
  ]);
});

test('the undo offer goes away by itself', async ({ monthPage }) => {
  const card = monthPage.card('Supermarket');
  await monthPage.row(card, 'bread').hover();
  await monthPage.row(card, 'bread').getByTitle('Delete').click();
  await expect(monthPage.undoToast).toBeVisible();
  await expect(monthPage.undoToast).toHaveCount(0, { timeout: 8_000 });
});
