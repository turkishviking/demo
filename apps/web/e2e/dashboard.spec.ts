import { expect, test } from '@playwright/test';

test('US-RE-1 CA0 — opening the app shows the dashboard directly, without login', async ({
  page,
}) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('API opérationnelle')).toBeVisible();
});

test('the navigation leads to people and groups', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('link', { name: 'Personnes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Personnes' })).toBeVisible();
  await nav.getByRole('link', { name: 'Groupes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Groupes' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Groupes' })).toHaveAttribute('aria-current', 'page');
});

test('unknown pages render the not-found page', async ({ page }) => {
  const response = await page.goto('/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
});
