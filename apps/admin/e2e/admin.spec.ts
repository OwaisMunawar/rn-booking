import { expect, test, type Page } from '@playwright/test';

const FADE = 'a0000000-0000-4000-8000-000000000001';
const LOFT = 'a0000000-0000-4000-8000-000000000002';

async function signInAs(page: Page, name: 'Morgan Lee' | 'Marcus Hale') {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(`Continue as ${name}`) }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

test('guests are sent to the login page', async ({ page }) => {
  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to the admin' })).toBeVisible();
});

test('a forged demo cookie is not accepted', async ({ page, context }) => {
  await context.addCookies([
    {
      name: 'rnb_demo_session',
      value: 'c0000000-0000-4000-8000-000000000001.forged',
      url: 'http://localhost:3100',
    },
  ]);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'Morgan Lee'));

  test('sees marketplace KPIs and the revenue chart', async ({ page }) => {
    await expect(page.getByText('Bookings today')).toBeVisible();
    await expect(page.getByText('Revenue, 30 days')).toBeVisible();
    await expect(page.getByText('Utilisation today')).toBeVisible();
    await expect(page.getByRole('img', { name: /Completed revenue/ })).toBeVisible();
  });

  test('filters bookings by status', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Bookings' }).click();
    await page.getByRole('link', { name: 'Past', exact: true }).click();
    await page.getByRole('link', { name: 'Completed', exact: true }).click();
    await expect(page).toHaveURL(/status=completed/);
    const badges = page.locator('tbody span.rounded-full');
    await expect(badges.first()).toHaveText('Completed');
    expect(new Set(await badges.allInnerTexts())).toEqual(new Set(['Completed']));
  });

  test('creates and deletes a provider', async ({ page }) => {
    await page.goto('/providers/new');
    await page.getByLabel('Name').fill('Smoke Test Studio');
    await page.getByRole('button', { name: 'Create provider' }).click();
    await expect(page.getByRole('heading', { name: 'Smoke Test Studio' })).toBeVisible();

    await page.getByLabel('Name').nth(1).fill('Trial session');
    await page.getByLabel('Price ($)').last().fill('45');
    await page.getByRole('button', { name: 'Add service' }).click();
    // The add form resets on success and the new service joins the list.
    await expect(page.locator('summary', { hasText: 'Trial session' })).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Delete provider' }).click();
    await expect(page).toHaveURL(/\/providers$/);
    await expect(page.getByText('Smoke Test Studio')).toHaveCount(0);
  });
});

test.describe('provider', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'Marcus Hale'));

  test('is scoped to their own listing', async ({ page }) => {
    await page.goto('/providers');
    await expect(page).toHaveURL(new RegExp(`/providers/${FADE}$`));
    const response = await page.goto(`/providers/${LOFT}`);
    expect(response?.status()).toBe(404);
  });

  test('only sees their own bookings', async ({ page }) => {
    await page.goto('/bookings?when=all');
    const providers = await page.locator('tbody td:nth-child(2) p.text-xs').allInnerTexts();
    expect(providers.length).toBeGreaterThan(0);
    expect(new Set(providers)).toEqual(new Set(['Fade & Co Barbers']));
    await expect(page.getByRole('link', { name: 'All providers' })).toHaveCount(0);
  });

  test('edits weekly hours', async ({ page }) => {
    await page.goto(`/providers/${FADE}/availability`);
    await page.getByLabel('Monday working end').fill('18:00');
    await page.getByRole('button', { name: 'Save weekly hours' }).click();
    await expect(page.getByText('Weekly hours saved.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Monday working end')).toHaveValue('18:00');
  });
});
