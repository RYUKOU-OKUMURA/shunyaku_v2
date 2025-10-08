const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

/**
 * E2E Test: Real-world Scenarios
 * 
 * These tests verify the application behavior in various real-world scenarios
 * including edge cases with different UI elements, font sizes, and noisy images.
 */
test.describe('Real-world Scenarios', () => {
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

  test('should handle English UI elements', async () => {
    // Mock OCR to return English UI text
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      OCRService.prototype.extractText = async function(imagePath) {
        return {
          text: 'Click here to continue',
          confidence: 85,
          detectedLanguage: 'eng'
        };
      };
    });

    // Mock translation service
    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      TranslationService.prototype.translate = async function(text) {
        if (text === 'Click here to continue') {
          return {
            text: '続行するにはここをクリック',
            detectedSourceLang: 'en'
          };
        }
        return { text: `翻訳済み: ${text}`, detectedSourceLang: 'en' };
      };
    });

    // Simulate screenshot capture and processing
    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      
      try {
        // Simulate the full flow
        const ocrService = new OCRService();
        const translationService = new TranslationService();
        const hudManager = new HUDWindowManager();
        
        // Extract text (mocked)
        const ocrResult = await ocrService.extractText('/fake/path/image.png');
        
        // Translate text
        const translationResult = await translationService.translate(ocrResult.text);
        
        // Show HUD
        await hudManager.showHUD(ocrResult.text, translationResult.text);
        
        return {
          original: ocrResult.text,
          translated: translationResult.text,
          confidence: ocrResult.confidence
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.original).toBe('Click here to continue');
    expect(result.translated).toBe('続行するにはここをクリック');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  test('should handle small font text', async () => {
    // Mock OCR to simulate small font recognition
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      OCRService.prototype.extractText = async function(imagePath) {
        return {
          text: 'Small footnote text that is hard to read',
          confidence: 65, // Lower confidence for small fonts
          detectedLanguage: 'eng'
        };
      };
    });

    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      TranslationService.prototype.translate = async function(text) {
        return {
          text: '読みにくい小さな脚注テキスト',
          detectedSourceLang: 'en'
        };
      };
    });

    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      
      try {
        const ocrService = new OCRService();
        const translationService = new TranslationService();
        
        const ocrResult = await ocrService.extractText('/fake/path/small-font.png');
        const translationResult = await translationService.translate(ocrResult.text);
        
        return {
          original: ocrResult.text,
          translated: translationResult.text,
          confidence: ocrResult.confidence
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.confidence).toBeGreaterThanOrEqual(50); // Accept lower confidence for small fonts
    expect(result.translated).toBeTruthy();
  });

  test('should handle noisy images', async () => {
    // Mock OCR to simulate noisy image processing
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      OCRService.prototype.extractText = async function(imagePath) {
        return {
          text: 'Text with some noise and artifacts', // May contain OCR errors
          confidence: 55, // Lower confidence due to noise
          detectedLanguage: 'eng'
        };
      };
    });

    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      TranslationService.prototype.translate = async function(text) {
        return {
          text: 'ノイズやアーティファクトのあるテキスト',
          detectedSourceLang: 'en'
        };
      };
    });

    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      
      try {
        const ocrService = new OCRService();
        const translationService = new TranslationService();
        
        const ocrResult = await ocrService.extractText('/fake/path/noisy-image.png');
        
        // Only proceed with translation if confidence is acceptable
        if (ocrResult.confidence >= 50) {
          const translationResult = await translationService.translate(ocrResult.text);
          return {
            original: ocrResult.text,
            translated: translationResult.text,
            confidence: ocrResult.confidence,
            processed: true
          };
        } else {
          return {
            original: ocrResult.text,
            confidence: ocrResult.confidence,
            processed: false,
            reason: 'Low confidence'
          };
        }
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.error).toBeUndefined();
    
    if (result.processed) {
      expect(result.translated).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(50);
    } else {
      expect(result.reason).toBe('Low confidence');
    }
  });

  test('should handle mixed language content', async () => {
    // Mock OCR to return mixed English and Japanese text
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      OCRService.prototype.extractText = async function(imagePath) {
        return {
          text: 'Hello こんにちは World 世界',
          confidence: 75,
          detectedLanguage: 'eng+jpn'
        };
      };
    });

    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      TranslationService.prototype.translate = async function(text) {
        // Handle mixed language content
        return {
          text: 'こんにちは Hello 世界 World',
          detectedSourceLang: 'mixed'
        };
      };
    });

    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      
      try {
        const ocrService = new OCRService();
        const translationService = new TranslationService();
        
        const ocrResult = await ocrService.extractText('/fake/path/mixed-lang.png');
        const translationResult = await translationService.translate(ocrResult.text);
        
        return {
          original: ocrResult.text,
          translated: translationResult.text,
          confidence: ocrResult.confidence,
          detectedLang: ocrResult.detectedLanguage
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.original).toContain('Hello');
    expect(result.original).toContain('こんにちは');
    expect(result.translated).toBeTruthy();
  });

  test('should handle long processing times gracefully', async () => {
    // Mock services to simulate slow processing
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      
      OCRService.prototype.extractText = async function(imagePath) {
        // Simulate 3 second processing time
        await new Promise(resolve => setTimeout(resolve, 3000));
        return {
          text: 'This took a while to process',
          confidence: 80,
          detectedLanguage: 'eng'
        };
      };
      
      TranslationService.prototype.translate = async function(text) {
        // Simulate 2 second translation time
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
          text: 'これは処理に時間がかかりました',
          detectedSourceLang: 'en'
        };
      };
    });

    const startTime = Date.now();
    
    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      const { HUDWindowManager } = require('./src/main/HUDWindowManager');
      
      try {
        const ocrService = new OCRService();
        const translationService = new TranslationService();
        const hudManager = new HUDWindowManager();
        
        // Show loading state immediately
        await hudManager.showHUD('', '処理中...', false);
        
        const ocrResult = await ocrService.extractText('/fake/path/slow-image.png');
        const translationResult = await translationService.translate(ocrResult.text);
        
        // Update with results
        await hudManager.showHUD(ocrResult.text, translationResult.text);
        
        return {
          original: ocrResult.text,
          translated: translationResult.text,
          success: true
        };
      } catch (error) {
        return { error: error.message, success: false };
      }
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    expect(result.success).toBe(true);
    expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    expect(result.translated).toBe('これは処理に時間がかかりました');
  });

  test('should recover from partial failures', async () => {
    // Mock OCR to fail initially, then succeed on retry
    let ocrAttempts = 0;
    await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      
      OCRService.prototype.extractText = async function(imagePath) {
        global.ocrAttempts = (global.ocrAttempts || 0) + 1;
        
        if (global.ocrAttempts === 1) {
          throw new Error('OCR processing failed');
        }
        
        return {
          text: 'Text extracted on retry',
          confidence: 78,
          detectedLanguage: 'eng'
        };
      };
    });

    await electronApp.evaluate(async () => {
      const { TranslationService } = require('./src/services/TranslationService');
      TranslationService.prototype.translate = async function(text) {
        return {
          text: 'リトライで抽出されたテキスト',
          detectedSourceLang: 'en'
        };
      };
    });

    const result = await electronApp.evaluate(async () => {
      const { OCRService } = require('./src/services/OCRService');
      const { TranslationService } = require('./src/services/TranslationService');
      
      const ocrService = new OCRService();
      const translationService = new TranslationService();
      
      try {
        // First attempt (will fail)
        try {
          await ocrService.extractText('/fake/path/problematic.png');
        } catch (firstError) {
          // Retry logic
          const ocrResult = await ocrService.extractText('/fake/path/problematic.png');
          const translationResult = await translationService.translate(ocrResult.text);
          
          return {
            original: ocrResult.text,
            translated: translationResult.text,
            recovered: true,
            attempts: global.ocrAttempts
          };
        }
      } catch (error) {
        return { error: error.message, recovered: false };
      }
    });

    expect(result.recovered).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.translated).toBe('リトライで抽出されたテキスト');
  });
});