import { THIS_MONTH, expect, test } from '../fixtures.ts';

test.beforeEach(async ({ monthPage }) => {
  await monthPage.open();
});

test('a new category is added at the end, then renamed and given a budget', async ({ monthPage, server }) => {
  const form = monthPage.page.locator('.new-category-form');
  await form.locator('input[name="name"]').fill('Pets');
  await form.getByRole('button', { name: 'Add' }).click();
  const pets = monthPage.card('Pets');
  await expect(pets).toBeVisible();

  await pets.locator('.category-name').click();
  // While it is edited, the name is an input, so the card can't be found by its name.
  const nameInput = monthPage.page.locator('.category-card input.inline-text-input');
  await nameInput.fill('Animals');
  await nameInput.press('Enter');
  const animals = monthPage.card('Animals');
  await expect(animals).toBeVisible();

  await animals.locator('.category-budget').click();
  await animals.locator('input.inline-number-input').fill('60');
  await animals.locator('input.inline-number-input').press('Enter');
  await expect(animals).toContainText('Budget €60.00');

  await monthPage.expectSaved();
  const saved = await server.month(THIS_MONTH);
  const category = saved.categories.at(-1)!;
  expect(category.name).toBe('Animals');
  expect(saved.budgets[category.id]).toBe(60);
});

test('a category name already in use is refused, in the page language', async ({ monthPage }) => {
  const form = monthPage.page.locator('.new-category-form');
  await form.locator('input[name="name"]').fill('lunch');
  await form.getByRole('button', { name: 'Add' }).click();
  await expect(form).toContainText('You already have a category with this name.');
});

test('a category with expenses cannot be removed; an empty one can', async ({ monthPage, server }) => {
  const supermarket = monthPage.card('Supermarket');
  await expect(supermarket.locator('.category-remove-button')).toHaveClass(/is-blocked/);

  monthPage.page.once('dialog', (dialog) => void dialog.accept()); // "Remove the category …?"
  const gifts = monthPage.card('Gifts');
  await gifts.hover();
  await gifts.locator('.category-remove-button').click();
  await expect(gifts).toHaveCount(0);
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).categories.some((category) => category.id === 'gifts')).toBe(false);
});

test('dragging a card by its header moves it, and the order is saved', async ({ monthPage, server }) => {
  const cards = monthPage.page.locator('.category-cards > .category-card');
  const firstName = await cards.nth(0).locator('.category-name').textContent();
  await cards.nth(0).scrollIntoViewIfNeeded(); // the mouse only reaches what is on screen
  const source = await cards.nth(0).locator('.category-card-header').boundingBox();
  const target = await cards.nth(2).boundingBox();
  expect(source && target).toBeTruthy();

  // Press on the header, move a few pixels to start the drag (it starts after 5 px), then go.
  await monthPage.page.mouse.move(source!.x + 20, source!.y + 10);
  await monthPage.page.mouse.down();
  await monthPage.page.mouse.move(source!.x + 30, source!.y + 14, { steps: 4 });
  await expect(monthPage.page.locator('.category-card.is-lifted')).toBeVisible();
  await monthPage.page.mouse.move(target!.x + target!.width - 10, target!.y + 20, { steps: 20 });
  await monthPage.page.mouse.up();

  await expect(cards.nth(0).locator('.category-name')).not.toHaveText(firstName!);
  await monthPage.expectSaved();
  expect((await server.month(THIS_MONTH)).categories[0]!.id).not.toBe('dinner');
});
