import { test, expect } from '@playwright/test';
import { cleanTestData } from './test-utils.js';

test.describe('Chore Recurrence', () => {
    test.beforeEach(async ({ page }) => {
        // Clean up test data before each test
        await cleanTestData();

        await page.goto('http://localhost:3000');

        // Wait for page to load and authentication to be bypassed
        await page.waitForLoadState('networkidle');

        // Wait for the main chores interface to load (should appear automatically with VITE_SKIP_AUTH=true)
        await page.waitForSelector('button[aria-label="Add new chore"]', { timeout: 30000 });
    });

    test('should add a new chore with daily recurrence', async ({ page }) => {
        // Listen for console errors and API calls
        page.on('console', msg => {
            console.log(`Browser console [${msg.type()}]:`, msg.text());
        });

        page.on('response', response => {
            if (response.url().includes('/api/chores')) {
                console.log(`API Response [${response.status()}]:`, response.url());
            }
        });

        await page.click('button[aria-label="Add new chore"]');
        await page.fill('input#chore-title', 'Test Daily Chore');

        // Set a schedule date (required for recurrence) - use today so it appears in today's list
        const today = new Date();
        const scheduleValue = today.toISOString().slice(0, 16); // Format for datetime-local input
        await page.fill('input#chore-schedule', scheduleValue);

        await page.check('input#chore-is-recurring');
        await page.selectOption('select#chore-recurrence-frequency', 'DAILY');

        // Try clicking submit and see what happens
        await page.locator('dialog button[type="submit"]').click();

        // Wait a bit to see if anything happens
        await page.waitForTimeout(5000);

        // Check if modal is still open (indicates form didn't submit)
        const dialogVisible = await page.locator('dialog').isVisible();
        console.log('Dialog still visible after submit:', dialogVisible);

        // Check if any chores exist at all
        const choreCount = await page.locator('li.chore').count();
        console.log('Total chore count:', choreCount);

        // If chore doesn't appear in Today's section due to timezone issues, check All Chores section
        const allChoresHeader = page.locator('h2').filter({ hasText: 'All Chores' });
        await allChoresHeader.click(); // Expand All Chores section

        // Wait for the chore to appear in All Chores section
        await expect(page.locator('li.chore h3').filter({ hasText: 'Test Daily Chore' }).first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('li.chore .icon-recurrence').first()).toBeVisible();
    });
});
