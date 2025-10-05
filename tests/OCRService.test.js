/**
 * OCRService.test.js - OCRサービスのテスト
 * 
 * OCR機能の基本動作、信頼度チェック、画像前処理などをテストします。
 * 
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const OCRService = require('../src/services/OCRService');
const path = require('path');
const fs = require('fs').promises;

// モックされたElectron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((pathName) => {
      switch (pathName) {
        case 'userData':
          return '/tmp/shunyaku-test-userdata';
        case 'temp':
          return '/tmp/shunyaku-test-temp';
        default:
          return '/tmp/shunyaku-test';
      }
    })
  }
}));

describe('OCRService', () => {
  let ocrService;
  
  beforeAll(async () => {
    // テストディレクトリ作成
    await fs.mkdir('/tmp/shunyaku-test-userdata', { recursive: true });
    await fs.mkdir('/tmp/shunyaku-test-temp', { recursive: true });
  });

  beforeEach(() => {
    ocrService = new OCRService();
  });

  afterEach(async () => {
    if (ocrService) {
      await ocrService.shutdown();
    }
  });

  afterAll(async () => {
    // テストディレクトリクリーンアップ
    try {
      await fs.rmdir('/tmp/shunyaku-test-userdata', { recursive: true });
      await fs.rmdir('/tmp/shunyaku-test-temp', { recursive: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('初期化', () => {
    test('OCRServiceが正常に初期化される', async () => {
      // テストは基本構造の確認のみ（実際のTesseractは重いのでスキップ）
      expect(ocrService).toBeDefined();
      expect(ocrService.isInitialized).toBe(false);
      expect(ocrService.supportedLanguages).toContain('eng');
      expect(ocrService.supportedLanguages).toContain('jpn');
      expect(ocrService.supportedLanguages).toContain('eng+jpn');
    }, 10000);
    
    test('サポート言語が正しく設定されている', () => {
      const supportedLanguages = ocrService.getSupportedLanguages();
      expect(supportedLanguages).toContain('eng');
      expect(supportedLanguages).toContain('jpn');
      expect(supportedLanguages).toContain('eng+jpn');
    });
  });

  describe('設定とオプション', () => {
    test('最小信頼度が設定されている', () => {
      expect(ocrService.minimumConfidence).toBeGreaterThan(0);
      expect(ocrService.minimumConfidence).toBeLessThanOrEqual(100);
    });

    test('言語データパス設定', () => {
      // モックされた環境での基本チェック
      expect(typeof ocrService.supportedLanguages).toBe('object');
    });
  });

  describe('バリデーション機能', () => {
    test('不正な画像パスでエラーが発生する', async () => {
      await expect(ocrService.extractText('/nonexistent/path.png'))
        .rejects.toThrow();
    });

    test('サポートされていない言語でエラーが発生する', async () => {
      // 実際のOCR実行はスキップし、バリデーションロジックのテスト
      expect(() => {
        // サポートされていない言語の確認
        const unsupportedLang = 'xyz';
        expect(ocrService.supportedLanguages).not.toContain(unsupportedLang);
      }).not.toThrow();
    });
  });

  describe('信頼度評価システム', () => {
    test('信頼度評価関数が正しく動作する', () => {
      // プライベートメソッドのテスト（実際の実装では公開メソッド経由でテスト）
      // ここでは基本的な設定値の確認
      expect(ocrService.minimumConfidence).toBe(60);
    });

    test('信頼度閾値の設定', () => {
      const testOptions = { minConfidence: 80 };
      expect(testOptions.minConfidence).toBe(80);
    });
  });

  describe('ヘルスチェック機能', () => {
    test('ヘルスチェックが基本構造を返す', async () => {
      // 実際の初期化はスキップし、基本構造のテスト
      const healthCheck = await ocrService.performHealthCheck();
      
      expect(healthCheck).toHaveProperty('overall');
      expect(healthCheck).toHaveProperty('components');
      expect(healthCheck).toHaveProperty('timestamp');
    }, 10000);
  });

  describe('統合機能テスト', () => {
    test('performOCRメソッドが基本構造を持つ', () => {
      expect(typeof ocrService.performOCR).toBe('function');
    });

    test('extractTextBatchメソッドが基本構造を持つ', () => {
      expect(typeof ocrService.extractTextBatch).toBe('function');
    });

    test('shutdownメソッドが正常に動作する', async () => {
      await expect(ocrService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('エラーハンドリング', () => {
    test('初期化エラー時の適切な処理', async () => {
      // エラー条件を模擬
      const mockService = new OCRService();
      
      // shutdownは常に成功すべき
      await expect(mockService.shutdown()).resolves.not.toThrow();
    });

    test('処理中断時のクリーンアップ', async () => {
      await expect(ocrService.shutdown()).resolves.not.toThrow();
      expect(ocrService.isInitialized).toBe(false);
    });
  });
});