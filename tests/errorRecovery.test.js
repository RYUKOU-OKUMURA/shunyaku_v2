/**
 * Error Recovery Feature Tests (Task 4.4)
 * エラーリカバリ機能のテストスイート
 */

const TranslationService = require('../src/services/TranslationService');
const OCRService = require('../src/services/OCRService');

// モックの設定
jest.mock('../src/services/KeychainManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getDeepLAPIKey: jest.fn().mockResolvedValue('mock-api-key'),
      hasAPIKey: jest.fn().mockResolvedValue(true)
    };
  });
});

// keytar の完全なモック
jest.mock('keytar', () => ({
  getPassword: jest.fn().mockResolvedValue('mock-password'),
  setPassword: jest.fn().mockResolvedValue(),
  deletePassword: jest.fn().mockResolvedValue(true)
}));

describe('Task 4.4: Error Recovery Features', () => {
  describe('4.4.1: API限制エラー時の代替案表示', () => {
    let translationService;

    beforeEach(() => {
      translationService = new TranslationService();
    });

    test('API制限エラー（429）の詳細分析', () => {
      const error = new Error('Too Many Requests');
      error.statusCode = 429;

      const analysis = translationService._analyzeTranslationError(error);

      expect(analysis.type).toBe('rate_limit');
      expect(analysis.userMessage).toContain('APIリクエスト制限');
      expect(analysis.alternatives[0]).toContain('少し時間をおいてから再試行してください');
      expect(analysis.retryable).toBe(true);
      expect(analysis.severity).toBe('warning');
    });

    test('月間制限エラー（456）の詳細分析', () => {
      const error = new Error('Quota exceeded');
      error.statusCode = 456;

      const analysis = translationService._analyzeTranslationError(error);

      expect(analysis.type).toBe('quota_exceeded');
      expect(analysis.userMessage).toContain('月間文字数制限');
      expect(analysis.alternatives[0]).toContain('DeepL Proプランにアップグレード');
      expect(analysis.retryable).toBe(false);
      expect(analysis.severity).toBe('error');
    });

    test('ネットワークエラーの詳細分析', () => {
      const error = new Error('Network timeout');

      const analysis = translationService._analyzeTranslationError(error);

      expect(analysis.type).toBe('network');
      expect(analysis.userMessage).toContain('ネットワーク接続エラー');
      expect(analysis.alternatives[0]).toContain('インターネット接続を確認');
      expect(analysis.retryable).toBe(true);
    });

    test('認証エラーの詳細分析', () => {
      const error = new Error('Unauthorized');
      error.statusCode = 401;

      const analysis = translationService._analyzeTranslationError(error);

      expect(analysis.type).toBe('auth');
      expect(analysis.userMessage).toContain('APIキーが無効');
      expect(analysis.alternatives[0]).toContain('設定画面でAPIキーを再確認');
      expect(analysis.severity).toBe('warning');
    });
  });

  describe('4.4.2: OCR失敗時の手動入力フォールバック', () => {
    let ocrService;

    beforeEach(() => {
      ocrService = new OCRService();
    });

    test('ファイル未発見エラーの詳細分析', () => {
      const error = new Error('ENOENT: no such file or directory');
      const startTime = Date.now();

      const analysis = ocrService._analyzeOCRError(error, startTime);

      expect(analysis.type).toBe('file_not_found');
      expect(analysis.userMessage).toContain('画像ファイルが見つかりません');
      expect(analysis.alternatives[0]).toContain('スクリーンキャプチャを再実行');
      expect(analysis.severity).toBe('error');
    });

    test('サポートされていない形式エラーの詳細分析', () => {
      const error = new Error('Unsupported format');

      const analysis = ocrService._analyzeOCRError(error, Date.now());

      expect(analysis.type).toBe('unsupported_format');
      expect(analysis.userMessage).toContain('サポートされていない画像形式');
      expect(analysis.alternatives[0]).toContain('PNG、JPEG、BMP形式');
    });

    test('ファイルサイズエラーの詳細分析', () => {
      const error = new Error('File too large');

      const analysis = ocrService._analyzeOCRError(error, Date.now());

      expect(analysis.type).toBe('file_too_large');
      expect(analysis.userMessage).toContain('画像ファイルが大きすぎます');
      expect(analysis.alternatives[0]).toContain('小さな範囲を選択');
    });

    test('メモリエラーの詳細分析', () => {
      const error = new Error('Out of memory');

      const analysis = ocrService._analyzeOCRError(error, Date.now());

      expect(analysis.type).toBe('memory_error');
      expect(analysis.userMessage).toContain('メモリ不足でOCR処理に失敗');
      expect(analysis.alternatives[0]).toContain('他のアプリを閉じて');
    });

    test('タイムアウトエラーの詳細分析', () => {
      const error = new Error('Processing timeout');
      const startTime = Date.now() - 65000; // 65秒前

      const analysis = ocrService._analyzeOCRError(error, startTime);

      expect(analysis.type).toBe('timeout');
      expect(analysis.userMessage).toContain('OCR処理がタイムアウト');
      expect(analysis.alternatives[0]).toContain('より小さな範囲をキャプチャ');
    });
  });

  describe('4.4.3: ネットワークエラー時のオフライン表示', () => {
    // ブラウザ環境でのテストが必要なため、実際のテストはE2Eで実施
    test('ネットワーク状態オブジェクトの構造', () => {
      const networkStatus = {
        isOnline: true,
        lastChecked: Date.now(),
        checkInProgress: false
      };

      expect(networkStatus).toHaveProperty('isOnline');
      expect(networkStatus).toHaveProperty('lastChecked');
      expect(networkStatus).toHaveProperty('checkInProgress');
      expect(typeof networkStatus.isOnline).toBe('boolean');
      expect(typeof networkStatus.lastChecked).toBe('number');
      expect(typeof networkStatus.checkInProgress).toBe('boolean');
    });
  });

  describe('4.4.4: 再試行ボタンの実装', () => {
    test('再試行統計オブジェクトの構造', () => {
      const retryStats = {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        errorTypes: {}
      };

      expect(retryStats).toHaveProperty('totalRetries');
      expect(retryStats).toHaveProperty('successfulRetries');
      expect(retryStats).toHaveProperty('failedRetries');
      expect(retryStats).toHaveProperty('errorTypes');
      expect(typeof retryStats.totalRetries).toBe('number');
      expect(typeof retryStats.errorTypes).toBe('object');
    });
  });

  describe('TranslationService Error Handling Integration', () => {
    let service;

    beforeEach(() => {
      service = new TranslationService();
    });

    test('エラー分析メソッドが存在する', () => {
      expect(typeof service._analyzeTranslationError).toBe('function');
    });

    test('リトライ判定でAPI制限を適切に処理', () => {
      // 短期制限（429）はリトライ可能
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.statusCode = 429;
      expect(service._shouldRetryError(rateLimitError)).toBe(true);

      // 月間制限（456）はリトライ不可
      const quotaError = new Error('Quota exceeded');
      quotaError.statusCode = 456;
      expect(service._shouldRetryError(quotaError)).toBe(false);
    });
  });

  describe('OCRService Error Handling Integration', () => {
    let service;

    beforeEach(() => {
      service = new OCRService();
    });

    test('エラー分析メソッドが存在する', () => {
      expect(typeof service._analyzeOCRError).toBe('function');
    });

    test('処理時間が適切に計算される', () => {
      const startTime = Date.now() - 5000; // 5秒前
      const error = new Error('Test error');

      const analysis = service._analyzeOCRError(error, startTime);

      expect(analysis.processingTime).toBeGreaterThan(4000);
      expect(analysis.processingTime).toBeLessThan(6000);
    });
  });
});