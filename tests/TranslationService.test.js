/**
 * TranslationService.test.js
 * 
 * TranslationServiceクラスのユニットテスト
 * モックを使用してDeepL APIとの連携をテスト
 * 
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const TranslationService = require('../src/services/TranslationService');

// deepl-nodeモジュールのモック
jest.mock('deepl-node', () => ({
    Translator: jest.fn().mockImplementation(() => ({
        translateText: jest.fn(),
        getUsage: jest.fn(),
        getSourceLanguages: jest.fn(),
        getTargetLanguages: jest.fn()
    }))
}));

// KeychainManagerのモック
jest.mock('../src/services/KeychainManager', () => {
    return jest.fn().mockImplementation(() => ({
        getDeepLAPIKey: jest.fn(),
        hasAPIKey: jest.fn()
    }));
});

const { Translator } = require('deepl-node');
const KeychainManager = require('../src/services/KeychainManager');

describe('TranslationService', () => {
    let translationService;
    let mockTranslator;
    let mockKeychainManager;

    beforeEach(() => {
        // モックをリセット
        jest.clearAllMocks();
        
        // TranslationServiceインスタンスを作成
        translationService = new TranslationService({
            maxRetries: 2,
            initialRetryDelay: 100,
            timeout: 5000
        });
        
        // モックインスタンスを取得
        mockKeychainManager = translationService.keychainManager;
        mockTranslator = {
            translateText: jest.fn(),
            getUsage: jest.fn(),
            getSourceLanguages: jest.fn(),
            getTargetLanguages: jest.fn()
        };
        
        // Translatorコンストラクタが適切なインスタンスを返すように設定
        Translator.mockImplementation(() => mockTranslator);
        
        // console.logをモック（テスト出力を抑制）
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // console モックを復元
        console.log.mockRestore();
        console.error.mockRestore();
        console.warn.mockRestore();
    });

    describe('constructor', () => {
        test('デフォルト設定でインスタンス化できる', () => {
            const service = new TranslationService();
            expect(service.maxRetries).toBe(3);
            expect(service.initialRetryDelay).toBe(1000);
            expect(service.maxRetryDelay).toBe(30000);
            expect(service.timeout).toBe(30000);
        });

        test('カスタム設定でインスタンス化できる', () => {
            const options = {
                maxRetries: 5,
                initialRetryDelay: 500,
                maxRetryDelay: 60000,
                timeout: 15000
            };
            const service = new TranslationService(options);
            expect(service.maxRetries).toBe(5);
            expect(service.initialRetryDelay).toBe(500);
            expect(service.maxRetryDelay).toBe(60000);
            expect(service.timeout).toBe(15000);
        });

        test('初期状態では初期化されていない', () => {
            expect(translationService.isInitialized()).toBe(false);
        });

        test('統計情報が初期化される', () => {
            expect(translationService.usageStats).toEqual({
                charactersTranslated: 0,
                requestCount: 0,
                successCount: 0,
                errorCount: 0
            });
        });
    });

    describe('initialize', () => {
        test('APIキーが存在する場合、初期化に成功する', async () => {
            // APIキーが存在することをモック
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('12345678-1234-1234-1234-123456789012:fx');
            
            // 使用量取得を成功させる（ヘルスチェック用）
            mockTranslator.getUsage.mockResolvedValue({
                character: { count: 0, limit: 500000 }
            });

            const result = await translationService.initialize();
            
            expect(result).toBe(true);
            expect(translationService.isInitialized()).toBe(true);
            expect(Translator).toHaveBeenCalledWith(
                '12345678-1234-1234-1234-123456789012:fx',
                {
                    timeout: 5000,
                    serverUrl: 'https://api-free.deepl.com'
                }
            );
        });

        test('APIキーが存在しない場合、初期化に失敗する', async () => {
            // APIキーが存在しないことをモック
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue(null);

            const result = await translationService.initialize();
            
            expect(result).toBe(false);
            expect(translationService.isInitialized()).toBe(false);
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('[TranslationService] 初期化エラー'),
                expect.any(Error)
            );
        });

        test('Pro APIキーの場合、適切なサーバーURLが設定される', async () => {
            // Pro APIキーをモック
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('12345678-1234-1234-1234-123456789012:px');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });

            await translationService.initialize();
            
            expect(Translator).toHaveBeenCalledWith(
                '12345678-1234-1234-1234-123456789012:px',
                {
                    timeout: 5000,
                    serverUrl: 'https://api.deepl.com'
                }
            );
        });
    });

    describe('translate', () => {
        beforeEach(async () => {
            // 初期化を済ませる
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });
            await translationService.initialize();
        });

        test('正常な翻訳リクエストが成功する', async () => {
            const mockResult = {
                text: 'こんにちは',
                detectedSourceLang: 'en'
            };
            mockTranslator.translateText.mockResolvedValue(mockResult);

            const result = await translationService.translate('Hello', 'ja');

            expect(result).toMatchObject({
                originalText: 'Hello',
                translatedText: 'こんにちは',
                sourceLanguage: 'en',
                targetLanguage: 'ja'
            });
            expect(result.duration).toBeDefined();
            expect(result.timestamp).toBeDefined();
            expect(result.usage.charactersCount).toBe(5);
        });

        test('無効なテキストの場合エラーが投げられる', async () => {
            await expect(translationService.translate('', 'ja'))
                .rejects
                .toThrow('翻訳するテキストが空です');
        });

        test('無効な言語コードの場合エラーが投げられる', async () => {
            await expect(translationService.translate('Hello', 'invalid'))
                .rejects
                .toThrow('サポートされていない翻訳先言語です');
        });

        test('長すぎるテキストの場合エラーが投げられる', async () => {
            const longText = 'a'.repeat(5001);
            await expect(translationService.translate(longText, 'ja'))
                .rejects
                .toThrow('テキストが長すぎます');
        });

        test('統計情報が更新される', async () => {
            const mockResult = { text: 'こんにちは', detectedSourceLang: 'en' };
            mockTranslator.translateText.mockResolvedValue(mockResult);

            await translationService.translate('Hello', 'ja');

            expect(translationService.usageStats).toMatchObject({
                charactersTranslated: 5,
                requestCount: 1,
                successCount: 1,
                errorCount: 0
            });
        });
    });

    describe('_translateWithRetry', () => {
        beforeEach(async () => {
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });
            await translationService.initialize();
        });

        test('リトライ可能エラー（429）で最大回数までリトライする', async () => {
            const retryableError = new Error('Too Many Requests');
            retryableError.statusCode = 429;
            
            // 最初の2回失敗、3回目で成功
            mockTranslator.translateText
                .mockRejectedValueOnce(retryableError)
                .mockRejectedValueOnce(retryableError)
                .mockResolvedValue({ text: 'こんにちは', detectedSourceLang: 'en' });

            const result = await translationService.translate('Hello', 'ja');

            expect(mockTranslator.translateText).toHaveBeenCalledTimes(3);
            expect(result.translatedText).toBe('こんにちは');
        });

        test('リトライ不可能エラー（401）では即座に失敗する', async () => {
            const nonRetryableError = new Error('Unauthorized');
            nonRetryableError.statusCode = 401;
            
            mockTranslator.translateText.mockRejectedValue(nonRetryableError);

            await expect(translationService.translate('Hello', 'ja'))
                .rejects
                .toThrow('翻訳に失敗しました');

            expect(mockTranslator.translateText).toHaveBeenCalledTimes(1);
        });

        test('最大リトライ回数を超えた場合失敗する', async () => {
            const retryableError = new Error('Server Error');
            retryableError.statusCode = 500;
            
            mockTranslator.translateText.mockRejectedValue(retryableError);

            await expect(translationService.translate('Hello', 'ja'))
                .rejects
                .toThrow('翻訳に失敗しました（3回試行）');

            expect(mockTranslator.translateText).toHaveBeenCalledTimes(3); // maxRetries + 1
        });
    });

    describe('_shouldRetryError', () => {
        test('リトライ可能なステータスコードを正しく識別する', () => {
            const retryableCodes = [429, 500, 502, 503, 504];
            
            retryableCodes.forEach(code => {
                const error = new Error('Test Error');
                error.statusCode = code;
                expect(translationService._shouldRetryError(error)).toBe(true);
            });
        });

        test('リトライ不可能なステータスコードを正しく識別する', () => {
            const nonRetryableCodes = [400, 401, 403, 404];
            
            nonRetryableCodes.forEach(code => {
                const error = new Error('Test Error');
                error.statusCode = code;
                expect(translationService._shouldRetryError(error)).toBe(false);
            });
        });

        test('ネットワークエラーをリトライ可能として識別する', () => {
            const networkErrors = [
                'timeout',
                'network error',
                'connection reset',
                'enotfound',
                'econnreset',
                'etimedout'
            ];
            
            networkErrors.forEach(errorText => {
                const error = new Error(errorText);
                expect(translationService._shouldRetryError(error)).toBe(true);
            });
        });
    });

    describe('_validateTranslationRequest', () => {
        test('有効なリクエストは検証をパスする', () => {
            const result = translationService._validateTranslationRequest('Hello', 'ja');
            expect(result.isValid).toBe(true);
        });

        test('空文字列は無効とされる', () => {
            const result = translationService._validateTranslationRequest('', 'ja');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('空です');
        });

        test('nullテキストは無効とされる', () => {
            const result = translationService._validateTranslationRequest(null, 'ja');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('無効です');
        });

        test('長すぎるテキストは無効とされる', () => {
            const longText = 'a'.repeat(5001);
            const result = translationService._validateTranslationRequest(longText, 'ja');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('長すぎます');
        });

        test('無効な言語コードは無効とされる', () => {
            const result = translationService._validateTranslationRequest('Hello', 'invalid');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('サポートされていない翻訳先言語です');
        });

        test('サポートされている言語コードは有効とされる', () => {
            const supportedLanguages = ['ja', 'en', 'en-us', 'de', 'fr', 'zh'];
            
            supportedLanguages.forEach(lang => {
                const result = translationService._validateTranslationRequest('Hello', lang);
                expect(result.isValid).toBe(true);
            });
        });
    });

    describe('getUsage', () => {
        beforeEach(async () => {
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });
            await translationService.initialize();
        });

        test('使用量情報を正常に取得する', async () => {
            const mockUsage = {
                character: { count: 1000, limit: 500000 },
                document: { count: 5, limit: 20 }
            };
            mockTranslator.getUsage.mockResolvedValue(mockUsage);

            const result = await translationService.getUsage();

            expect(result).toMatchObject({
                character: { count: 1000, limit: 500000 },
                document: { count: 5, limit: 20 }
            });
            expect(result.localStats).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });

        test('初期化されていない場合エラーが投げられる', async () => {
            const uninitializedService = new TranslationService();
            
            await expect(uninitializedService.getUsage())
                .rejects
                .toThrow('TranslationServiceが初期化されていません');
        });
    });

    describe('getSupportedLanguages', () => {
        test('サポート言語一覧を正常に取得する', async () => {
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });
            
            const mockSourceLangs = [
                { code: 'en', name: 'English' },
                { code: 'ja', name: 'Japanese' }
            ];
            const mockTargetLangs = [
                { code: 'ja', name: 'Japanese', supportsFormality: false },
                { code: 'de', name: 'German', supportsFormality: true }
            ];

            mockTranslator.getSourceLanguages.mockResolvedValue(mockSourceLangs);
            mockTranslator.getTargetLanguages.mockResolvedValue(mockTargetLangs);

            const result = await translationService.getSupportedLanguages();

            expect(result.source).toHaveLength(2);
            expect(result.target).toHaveLength(2);
            expect(result.target[1].supportsFormality).toBe(true);
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('healthCheck', () => {
        test('健全な状態でヘルスチェックが成功する', async () => {
            mockKeychainManager.hasAPIKey.mockResolvedValue(true);
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });

            const result = await translationService.healthCheck();

            expect(result.status).toBe('healthy');
            expect(result.checks.apiKeyExists).toBe(true);
            expect(result.checks.initialized).toBe(true);
            expect(result.checks.apiConnection).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('APIキーが存在しない場合ヘルスチェックが失敗する', async () => {
            mockKeychainManager.hasAPIKey.mockResolvedValue(false);

            const result = await translationService.healthCheck();

            expect(result.status).toBe('unhealthy');
            expect(result.checks.apiKeyExists).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('resetStats', () => {
        test('統計情報がリセットされる', () => {
            // 統計情報を変更
            translationService.usageStats = {
                charactersTranslated: 100,
                requestCount: 5,
                successCount: 4,
                errorCount: 1
            };

            translationService.resetStats();

            expect(translationService.usageStats).toEqual({
                charactersTranslated: 0,
                requestCount: 0,
                successCount: 0,
                errorCount: 0
            });
        });
    });

    describe('cleanup', () => {
        test('リソースがクリーンアップされる', async () => {
            // 初期化してからクリーンアップ
            mockKeychainManager.getDeepLAPIKey.mockResolvedValue('test-api-key:fx');
            mockTranslator.getUsage.mockResolvedValue({ character: { count: 0, limit: 500000 } });
            await translationService.initialize();

            expect(translationService.isInitialized()).toBe(true);

            await translationService.cleanup();

            expect(translationService.translator).toBeNull();
        });
    });
});