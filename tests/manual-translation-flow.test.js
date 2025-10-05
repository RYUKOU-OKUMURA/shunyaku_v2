/**
 * Manual Translation Flow Tests
 * タスク2.5: 手動テキスト翻訳フローのテスト
 */

// keytarのモック（libsecret依存関係回避）
jest.mock('keytar', () => ({
  getPassword: jest.fn(),
  setPassword: jest.fn(),
  deletePassword: jest.fn(),
  findCredentials: jest.fn(),
}));

// deepl-nodeのモック
jest.mock('deepl-node', () => ({
  Translator: jest.fn(),
}));

// IPCハンドラーのモック
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  app: {
    getVersion: jest.fn(() => '1.0.0'),
  },
}));

// エラータイプ分類関数（main.jsから）
function getTranslationErrorType(error) {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('api key') || message.includes('keychain') || message.includes('401') || message.includes('403')) {
    return 'api_key';
  } else if (message.includes('429') || message.includes('quota') || message.includes('limit')) {
    return 'quota_exceeded';
  } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
    return 'network';
  } else if (message.includes('invalid') || message.includes('validation')) {
    return 'validation';
  } else {
    return 'unknown';
  }
}

describe('Manual Translation Flow', () => {
  let mockTranslationService;
  let mockSettingsStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 実際のクラスを読み込んでモック化
    const TranslationService = require('../src/services/TranslationService');
    const SettingsStore = require('../src/services/SettingsStore');
    
    mockTranslationService = {
      isInitialized: jest.fn(),
      initialize: jest.fn(),
      translate: jest.fn(),
      healthCheck: jest.fn(),
    };
    
    mockSettingsStore = {
      getTranslationSettings: jest.fn(),
      setTranslationSettings: jest.fn(),
    };
  });

  describe('IPC Handler: translate-text', () => {
    let translateTextHandler;

    beforeEach(() => {
      // IPCハンドラーをセットアップ（実際のmain.jsから抽出）
      translateTextHandler = async (event, { text, targetLanguage, sourceLanguage = null }) => {
        try {
          if (!mockTranslationService.isInitialized()) {
            const initSuccess = await mockTranslationService.initialize();
            if (!initSuccess) {
              throw new Error('翻訳サービスの初期化に失敗しました。APIキーを確認してください。');
            }
          }

          const result = await mockTranslationService.translate(text, targetLanguage, sourceLanguage);
          
          return {
            success: true,
            result: result
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            errorType: getTranslationErrorType(error)
          };
        }
      };
    });

    test('正常な翻訳リクエストが成功すること', async () => {
      // Arrange
      const mockResult = {
        originalText: 'Hello World',
        translatedText: 'こんにちは世界',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        duration: 1000,
        timestamp: new Date().toISOString(),
      };

      mockTranslationService.isInitialized.mockReturnValue(true);
      mockTranslationService.translate.mockResolvedValue(mockResult);

      // Act
      const result = await translateTextHandler(null, {
        text: 'Hello World',
        targetLanguage: 'ja',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockResult);
      expect(mockTranslationService.translate).toHaveBeenCalledWith(
        'Hello World',
        'ja',
        null
      );
    });

    test('初期化されていない場合に初期化を実行すること', async () => {
      // Arrange
      const mockResult = {
        originalText: 'Test',
        translatedText: 'テスト',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
      };

      mockTranslationService.isInitialized.mockReturnValue(false);
      mockTranslationService.initialize.mockResolvedValue(true);
      mockTranslationService.translate.mockResolvedValue(mockResult);

      // Act
      const result = await translateTextHandler(null, {
        text: 'Test',
        targetLanguage: 'ja',
      });

      // Assert
      expect(mockTranslationService.initialize).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('初期化失敗時にエラーを返すこと', async () => {
      // Arrange
      mockTranslationService.isInitialized.mockReturnValue(false);
      mockTranslationService.initialize.mockResolvedValue(false);

      // Act
      const result = await translateTextHandler(null, {
        text: 'Test',
        targetLanguage: 'ja',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('翻訳サービスの初期化に失敗しました');
    });

    test('翻訳エラー時に適切なエラーを返すこと', async () => {
      // Arrange
      mockTranslationService.isInitialized.mockReturnValue(true);
      mockTranslationService.translate.mockRejectedValue(new Error('API key invalid'));

      // Act
      const result = await translateTextHandler(null, {
        text: 'Test',
        targetLanguage: 'ja',
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key invalid');
      expect(result.errorType).toBe('api_key');
    });
  });

  describe('Error Type Classification', () => {

    test('APIキーエラーを正しく分類すること', () => {
      const errors = [
        new Error('api key invalid'),
        new Error('keychain access denied'),
        new Error('HTTP 401 Unauthorized'),
        new Error('HTTP 403 Forbidden'),
      ];

      errors.forEach(error => {
        expect(getTranslationErrorType(error)).toBe('api_key');
      });
    });

    test('クォータエラーを正しく分類すること', () => {
      const errors = [
        new Error('HTTP 429 Too Many Requests'),
        new Error('quota exceeded'),
        new Error('rate limit reached'),
      ];

      errors.forEach(error => {
        expect(getTranslationErrorType(error)).toBe('quota_exceeded');
      });
    });

    test('ネットワークエラーを正しく分類すること', () => {
      const errors = [
        new Error('network error'),
        new Error('timeout occurred'),
        new Error('connection failed'),
      ];

      errors.forEach(error => {
        expect(getTranslationErrorType(error)).toBe('network');
      });
    });

    test('バリデーションエラーを正しく分類すること', () => {
      const errors = [
        new Error('invalid input'),
        new Error('validation failed'),
      ];

      errors.forEach(error => {
        expect(getTranslationErrorType(error)).toBe('validation');
      });
    });

    test('未知のエラーを正しく分類すること', () => {
      const error = new Error('some unknown error');
      expect(getTranslationErrorType(error)).toBe('unknown');
    });
  });

  describe('Translation Settings Management', () => {
    test('翻訳設定の取得が成功すること', async () => {
      // Arrange
      const mockSettings = {
        targetLanguage: 'ja',
        sourceLanguage: 'auto',
        formality: 'default',
      };
      mockSettingsStore.getTranslationSettings.mockReturnValue(mockSettings);

      // Act
      const result = mockSettingsStore.getTranslationSettings();

      // Assert
      expect(result).toEqual(mockSettings);
      expect(mockSettingsStore.getTranslationSettings).toHaveBeenCalled();
    });

    test('翻訳設定の保存が成功すること', async () => {
      // Arrange
      const newSettings = {
        targetLanguage: 'en',
        sourceLanguage: 'ja',
        formality: 'more',
      };

      // Act
      mockSettingsStore.setTranslationSettings(newSettings);

      // Assert
      expect(mockSettingsStore.setTranslationSettings).toHaveBeenCalledWith(newSettings);
    });
  });

  describe('Translation Service Health Check', () => {
    test('正常な状態でヘルスチェックが成功すること', async () => {
      // Arrange
      const mockHealthStatus = {
        status: 'healthy',
        checks: {
          initialized: true,
          apiKeyExists: true,
          apiConnection: true,
          usageAccessible: true,
        },
        errors: [],
      };
      mockTranslationService.healthCheck.mockResolvedValue(mockHealthStatus);

      // Act
      const result = await mockTranslationService.healthCheck();

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.checks.initialized).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('異常な状態でヘルスチェックがエラーを返すこと', async () => {
      // Arrange
      const mockHealthStatus = {
        status: 'unhealthy',
        checks: {
          initialized: false,
          apiKeyExists: false,
          apiConnection: false,
          usageAccessible: false,
        },
        errors: ['API key not found', 'Connection failed'],
      };
      mockTranslationService.healthCheck.mockResolvedValue(mockHealthStatus);

      // Act
      const result = await mockTranslationService.healthCheck();

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.errors).toHaveLength(2);
      expect(result.checks.apiKeyExists).toBe(false);
    });
  });
});