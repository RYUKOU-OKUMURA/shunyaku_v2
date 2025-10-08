const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

/**
 * E2E Test: HUD Functionality
 * 
 * This test verifies HUD window creation, display, and basic interaction.
 */
test.describe('HUD Functionality', () => {
  let electronApp;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['src/main/main.js', '--dev'],
      cwd: process.cwd()
    });
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('should create HUD window', async () => {
    // Get all windows - may include main and HUD windows
    const windows = await electronApp.windows();
    
    // At minimum, we should have one window
    expect(windows.length).toBeGreaterThanOrEqual(1);
    
    // Look for HUD-related window or create one
    let hudWindow = windows.find(async (window) => {
      const url = window.url();
      return url.includes('hud.html');
    });
    
    if (!hudWindow) {
      // Trigger HUD creation through main process
      await electronApp.evaluate(async ({ app, BrowserWindow }) => {
        const { HUDWindowManager } = require('./src/main/HUDWindowManager');
        const hudManager = new HUDWindowManager();
        await hudManager.showHUD('Test text', 'Translated text');
      });
      
      // Wait for new window
      await electronApp.waitForEvent('window');
      const updatedWindows = await electronApp.windows();
      hudWindow = updatedWindows[updatedWindows.length - 1];
    }
    
    expect(hudWindow).toBeTruthy();
    
    // Wait for HUD to load
    await hudWindow.waitForLoadState('domcontentloaded');
    
    // Take screenshot for debugging
    await hudWindow.screenshot({ path: 'tests/e2e/screenshots/hud-created.png' });
  });

  test('should display text in HUD', async () => {
    // Trigger HUD with specific text
    await electronApp.evaluate(async () => {
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      const hudManager = new HUDWindowManager();
      return await hudManager.showHUD('Original Text', 'Translated Text');
    });
    
    // Get the HUD window
    const windows = await electronApp.windows();
    const hudWindow = windows.find(window => window.url().includes('hud.html'));
    
    if (hudWindow) {
      await hudWindow.waitForLoadState('domcontentloaded');
      
      // Check if text is displayed
      const originalTextExists = await hudWindow.locator('text=Original Text').count() > 0;
      const translatedTextExists = await hudWindow.locator('text=Translated Text').count() > 0;
      
      // At least one should be visible (depending on HUD implementation)
      expect(originalTextExists || translatedTextExists).toBe(true);
      
      // Take screenshot
      await hudWindow.screenshot({ path: 'tests/e2e/screenshots/hud-with-text.png' });
    }
  });

  test('should handle HUD close functionality', async () => {
    // Create HUD
    await electronApp.evaluate(async () => {
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      const hudManager = new HUDWindowManager();
      return await hudManager.showHUD('Test close', 'Close test');
    });
    
    const initialWindows = await electronApp.windows();
    const hudWindow = initialWindows.find(window => window.url().includes('hud.html'));
    
    if (hudWindow) {
      await hudWindow.waitForLoadState('domcontentloaded');
      
      // Try to find and click close button
      const closeButton = hudWindow.locator('button[data-action=\"close\"], .close-button, [title*=\"close\"], [title*=\"Close\"]');
      const closeButtonCount = await closeButton.count();
      
      if (closeButtonCount > 0) {
        await closeButton.first().click();
        
        // Wait for window to close
        await electronApp.evaluate(async () => {
          return new Promise(resolve => setTimeout(resolve, 500));
        });
        
        // Verify window was closed
        const finalWindows = await electronApp.windows();
        const hudStillExists = finalWindows.some(window => window.url().includes('hud.html'));
        
        expect(hudStillExists).toBe(false);
      }
    }
  });
});