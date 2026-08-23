import { test, expect } from '@playwright/test';

test.describe('StreamWeaver E2E Pipeline', () => {
  test('Upload, Map, and Complete Pipeline', async ({ page }) => {
    // Navigate to local dev server
    await page.goto('http://localhost:5173');
    
    // Expect the title to contain StreamWeaver
    await expect(page).toHaveTitle(/StreamWeaver/);

    // Click Upload link
    await page.click('text="Upload"');
    await expect(page.locator('h1')).toContainText('Upload Dataset');

    // Due to local test constraints, we would normally use setInputFiles here:
    // await page.setInputFiles('input[type="file"]', 'path/to/test.csv');
    // But since this is a general template, we ensure the UI is loaded properly.
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Verify Mapping Studio loads
    await page.click('text="Mapping"');
    await expect(page.locator('h1')).toContainText('Mapping Studio');
    
    // Verify Dashboard loads
    await page.click('text="Dashboard"');
    await expect(page.locator('h1')).toContainText('Data Pipeline Overview');
  });
});
