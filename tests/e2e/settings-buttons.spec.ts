import { test, expect } from '@playwright/test';

test.describe('Settings Page Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3111/dashboard/settings');
    await page.waitForLoadState('networkidle');
  });

  test('all 5 tab buttons are visible and clickable', async ({ page }) => {
    const tabs = ['General', 'API Keys', 'Curator thresholds', 'Exports', 'Team access'];
    for (const tab of tabs) {
      const button = page.locator('nav button', { hasText: tab });
      await expect(button).toBeVisible();
      await button.click();
      await page.waitForTimeout(200);
    }
  });

  test('General tab interactive elements', async ({ page }) => {
    await page.locator('nav button', { hasText: 'General' }).click();
    
    // Group scope input (use placeholder or label text instead of type)
    const input = page.locator('input').first();
    await expect(input).toBeVisible();
    await input.fill('test-group-id');
    
    // Change button
    const changeBtn = page.locator('button:has-text("Change")').first();
    await expect(changeBtn).toBeVisible();
    
    // Promotion mode switch
    const switchBtn = page.locator('button[role="switch"]').first();
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();
  });

  test('API Keys tab interactive elements', async ({ page }) => {
    await page.locator('nav button', { hasText: 'API Keys' }).click();
    
    // Show/Hide button
    const showHideBtn = page.locator('button:has-text("Show")').first();
    await expect(showHideBtn).toBeVisible();
    await showHideBtn.click();
    
    // Regenerate button
    const regenBtn = page.locator('button:has-text("Regenerate")').first();
    await expect(regenBtn).toBeVisible();
  });

  test('Curator thresholds tab interactive elements', async ({ page }) => {
    await page.locator('nav button', { hasText: 'Curator thresholds' }).click();
    
    // Confidence input
    const confidenceInput = page.locator('input[type="number"]').first();
    await expect(confidenceInput).toBeVisible();
    await confidenceInput.fill('0.95');
    
    // Max daily promotions input
    const maxInput = page.locator('input[type="number"]').nth(1);
    await expect(maxInput).toBeVisible();
    await maxInput.fill('100');
  });

  test('Exports tab interactive elements', async ({ page }) => {
    await page.locator('nav button', { hasText: 'Exports' }).click();
    
    // Download buttons
    const downloadBtns = page.locator('button:has-text("Download")');
    await expect(downloadBtns).toHaveCount(3);
    
    for (let i = 0; i < 3; i++) {
      await expect(downloadBtns.nth(i)).toBeVisible();
    }
  });

  test('Team access tab interactive elements', async ({ page }) => {
    await page.locator('nav button', { hasText: 'Team access' }).click();
    
    // Invite member button
    const inviteBtn = page.locator('button:has-text("Invite member")');
    await expect(inviteBtn).toBeVisible();
  });
});
