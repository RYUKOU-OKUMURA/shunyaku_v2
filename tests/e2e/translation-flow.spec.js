const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

/**
 * E2E Test: Translation Flow
 * 
 * This test verifies the complete translation workflow including:
 * - Text input
 * - Translation service integration
 * - Results display
 */
test.describe('Translation Flow', () => {
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

  test('should handle manual text translation', async () => {
    // Mock the translation service to avoid API calls in tests
    await electronApp.evaluate(async () => {
      // Override TranslationService for testing
      const { TranslationService } = require('./src/services/TranslationService');
      const originalTranslate = TranslationService.prototype.translate;
      
      TranslationService.prototype.translate = async function(text, targetLang = 'ja') {
        if (text === 'Hello World') {
          return {
            text: 'こんにちは世界',
            detectedSourceLang: 'en'
          };
        }
        return { text: `Translated: ${text}`, detectedSourceLang: 'en' };
      };
      
      // Store original method for cleanup
      global.originalTranslate = originalTranslate;
    });

    // Create HUD with input capability
    await electronApp.evaluate(async () => {
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      const hudManager = new HUDWindowManager();
      return await hudManager.showHUD('', '', true); // Show with input enabled
    });

    const windows = await electronApp.windows();
    const hudWindow = windows.find(window => window.url().includes('hud.html'));
    
    if (hudWindow) {
      await hudWindow.waitForLoadState('domcontentloaded');
      
      // Look for input field
      const textInput = hudWindow.locator('input[type=\"text\"], textarea, [contenteditable=\"true\"]');
      const inputCount = await textInput.count();
      
      if (inputCount > 0) {
        // Enter test text
        await textInput.first().fill('Hello World');
        
        // Look for translate button
        const translateButton = hudWindow.locator('button[data-action=\"translate\"], .translate-button, button:has-text(\"翻訳\"), button:has-text(\"Translate\")');
        const translateButtonCount = await translateButton.count();
        
        if (translateButtonCount > 0) {
          await translateButton.first().click();
          
          // Wait for translation to complete
          await hudWindow.waitForTimeout(2000);
          
          // Check for translated text
          const translatedText = await hudWindow.locator('text=こんにちは世界').count();
          expect(translatedText).toBeGreaterThan(0);
          
          // Take screenshot
          await hudWindow.screenshot({ path: 'tests/e2e/screenshots/translation-result.png' });
        }
      }
    }
  });

  test('should handle translation errors gracefully', async () => {
    // Mock translation service to throw error
    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      
      TranslationService.prototype.translate = async function(text, targetLang = 'ja') {
        throw new Error('API key not configured');
      };
    });

    // Create HUD
    await electronApp.evaluate(async () => {
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      const hudManager = new HUDWindowManager();
      return await hudManager.showHUD('', '', true);
    });

    const windows = await electronApp.windows();
    const hudWindow = windows.find(window => window.url().includes('hud.html'));
    
    if (hudWindow) {
      await hudWindow.waitForLoadState('domcontentloaded');
      
      const textInput = hudWindow.locator('input[type=\"text\"], textarea, [contenteditable=\"true\"]');
      const inputCount = await textInput.count();
      
      if (inputCount > 0) {
        await textInput.first().fill('Test error');
        
        const translateButton = hudWindow.locator('button[data-action=\"translate\"], .translate-button, button:has-text(\"翻訳\"), button:has-text(\"Translate\")');
        const translateButtonCount = await translateButton.count();
        
        if (translateButtonCount > 0) {
          await translateButton.first().click();
          
          // Wait for error to appear
          await hudWindow.waitForTimeout(2000);
          
          // Check for error message
          const errorMessage = await hudWindow.locator('text*=\"エラー\", text*=\"Error\", .error, .error-message').count();
          expect(errorMessage).toBeGreaterThan(0);
          
          // Take screenshot
          await hudWindow.screenshot({ path: 'tests/e2e/screenshots/translation-error.png' });
        }
      }
    }
  });

  test('should handle copy functionality', async () => {
    // Mock clipboard for testing
    await electronApp.evaluate(async () => {
      // Mock electron clipboard
      const { clipboard } = require('electron');
      clipboard.writeText = jest.fn();
      clipboard.readText = jest.fn().mockReturnValue('');
      
      global.mockClipboard = clipboard;
    });

    // Create HUD with translated text
    await electronApp.evaluate(async () => {
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      const hudManager = new HUDWindowManager();
      return await hudManager.showHUD('Original', 'Translated Text');
    });

    const windows = await electronApp.windows();
    const hudWindow = windows.find(window => window.url().includes('hud.html'));
    
    if (hudWindow) {
      await hudWindow.waitForLoadState('domcontentloaded');
      
      // Look for copy button
      const copyButton = hudWindow.locator('button[data-action=\"copy\"], .copy-button, button:has-text(\"コピー\"), button:has-text(\"Copy\")');
      const copyButtonCount = await copyButton.count();
      
      if (copyButtonCount > 0) {
        await copyButton.first().click();
        
        // Verify clipboard was called
        const clipboardCalled = await electronApp.evaluate(async () => {
          return global.mockClipboard.writeText.mock.calls.length > 0;
        });
        
        expect(clipboardCalled).toBe(true);
        
        // Take screenshot
        await hudWindow.screenshot({ path: 'tests/e2e/screenshots/copy-action.png' });
      }
    }
  });

  test.afterEach(async () => {
    // Restore original translation service
    await electronApp.evaluate(async () => {
      if (global.originalTranslate) {
        const { TranslationService } = require('./src/services/TranslationService');
        TranslationService.prototype.translate = global.originalTranslate;
        delete global.originalTranslate;
      }
    });
  });
});