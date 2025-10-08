const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

/**
 * E2E Test: Electron App Launch
 * 
 * This test verifies that the Electron application launches correctly
 * and initializes all basic components.
 */
test.describe('Electron App Launch', () => {
  let electronApp;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: ['src/main/main.js'],
      cwd: process.cwd()
    });
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('should launch Electron app successfully', async () => {
    // Get the first window that the app opens, wait if necessary
    const window = await electronApp.firstWindow();
    
    // Verify window exists
    expect(window).toBeTruthy();
    
    // Wait for the app to be ready
    await window.waitForLoadState('domcontentloaded');
    
    // Check if the window has proper title (or any title)
    const title = await window.title();
    expect(title).toBeTruthy();
    
    // Take a screenshot for debugging if needed
    await window.screenshot({ path: 'tests/e2e/screenshots/app-launch.png' });
  });

  test('should have main process running', async () => {
    // Verify main process is accessible
    const mainProcess = electronApp.process();
    expect(mainProcess).toBeTruthy();
    
    // Check if main process has the expected PID
    expect(mainProcess.pid).toBeGreaterThan(0);
  });

  test('should be able to evaluate in main process', async () => {
    // Test main process evaluation
    const result = await electronApp.evaluate(async ({ app }) => {
      return {
        name: app.getName(),
        version: app.getVersion(),
        isReady: app.isReady()
      };
    });
    
    expect(result.name).toBe('shunyaku-v2');
    expect(result.version).toBeTruthy();
    expect(result.isReady).toBe(true);
  });
});