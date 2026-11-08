import { THIS_MONTH, expect, test } from '../fixtures.ts';

test.beforeEach(async ({ monthPage }) => {
  await monthPage.open();
});

test('the Income card adds an entry, and Earned adds it up', async ({ monthPage, server }) => {
  await monthPage.incomeCard.locator('input[name="description"]').fill('lesson');
  await monthPage.incomeCard.getByPlaceholder('€').fill('40');
  await monthPage.incomeCard.getByRole('button', { name: '+' }).click();
  await expect(monthPage.row(monthPage.incomeCard, 'lesson')).toContainText('€40.00');
  await expect(monthPage.page.locator('.summary-card').first()).toContainText('€3,040.00');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).income.entries).toHaveLength(2);
});

test('a removed income entry comes back with Undo', async ({ monthPage, server }) => {
  const salary = monthPage.row(monthPage.incomeCard, 'salary');
  await salary.hover();
  await salary.getByTitle('Delete').click();
  await expect(salary).toHaveCount(0);
  await expect(monthPage.undoToast).toContainText('Income removed (€3,000.00)');
  await monthPage.undoToast.getByRole('button', { name: 'Undo' }).click();
  await expect(salary).toContainText('€3,000.00');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).income.entries).toHaveLength(1);
});

test('clicking the expected income changes it', async ({ monthPage, server }) => {
  const earned = monthPage.page.locator('.summary-card').first();
  await earned.locator('.click-to-edit').click();
  await earned.locator('input').fill('3500');
  await earned.locator('input').press('Enter');
  await expect(earned).toContainText('Expected €3,500.00');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).income.expected).toBe(3500);
});

test('a subscription can be added, named, priced, removed and brought back', async ({ monthPage, server }) => {
  const subscriptions = monthPage.recurringList('subscriptions');
  await monthPage.page.locator('.recurring-costs-panel .text-button').nth(1).click();
  const row = subscriptions.locator('.recurring-cost-row').last();
  const name = row.locator('.recurring-cost-name');
  await expect(name).toBeFocused(); // ready to type its name
  await name.fill('Music');
  await name.press('Enter');
  const amount = row.locator('input[type="number"]');
  await amount.fill('9.99');
  await amount.press('Enter');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).subscriptions).toEqual([
    expect.objectContaining({ name: 'Music', amount: 9.99 }),
  ]);

  await row.hover();
  await row.getByTitle('Remove').click();
  await expect(subscriptions.locator('.recurring-cost-row')).toHaveCount(0);
  await expect(monthPage.undoToast).toContainText('Music removed');
  await monthPage.undoToast.getByRole('button', { name: 'Undo' }).click();
  await expect(subscriptions.locator('.recurring-cost-name')).toHaveValue('Music');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).subscriptions).toEqual([
    expect.objectContaining({ name: 'Music', amount: 9.99 }),
  ]);
});

test('a fixed cost amount can be changed', async ({ monthPage, server }) => {
  const rent = monthPage.recurringList('fixed').locator('.recurring-cost-row').first();
  await expect(rent.locator('.recurring-cost-name')).toHaveValue('Rent');
  await rent.locator('input[type="number"]').fill('950');
  await rent.locator('input[type="number"]').press('Enter');
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).fixed[0]!.amount).toBe(950);
});
