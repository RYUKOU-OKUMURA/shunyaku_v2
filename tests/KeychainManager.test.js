/**
 * KeychainManager.test.js
 * 
 * KeychainManagerクラスのユニットテスト
 * モックを使用してmacOS Keychainとの連携をテスト
 * 
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const KeychainManager = require('../src/services/KeychainManager');

// keytarモジュールのモック
jest.mock('keytar', () => ({
    setPassword: jest.fn(),
    getPassword: jest.fn(),
    deletePassword: jest.fn(),
    findCredentials: jest.fn()
}));

const keytar = require('keytar');

describe('KeychainManager', () => {
    let keychainManager;

    beforeEach(() => {
        // モックをリセット
        jest.clearAllMocks();
        
        // KeychainManagerインスタンスを作成
        keychainManager = new KeychainManager('Test Service');
        
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
        test('デフォルトサービス名でインスタンス化できる', () => {
            const manager = new KeychainManager();
            expect(manager.serviceName).toBe('Shunyaku v2');
        });

        test('カスタムサービス名でインスタンス化できる', () => {
            const manager = new KeychainManager('Custom Service');
            expect(manager.serviceName).toBe('Custom Service');
        });
    });

    describe('saveAPIKey', () => {
        test('正常なAPIキーを保存できる', async () => {
            keytar.setPassword.mockResolvedValue(true);

            const result = await keychainManager.saveAPIKey('test_key', 'test_value');

            expect(result).toBe(true);
            expect(keytar.setPassword).toHaveBeenCalledWith('Test Service', 'test_key', 'test_value');
            expect(keytar.setPassword).toHaveBeenCalledTimes(1);
        });

        test('空のキー名でエラーを返す', async () => {
            const result = await keychainManager.saveAPIKey('', 'test_value');

            expect(result).toBe(false);
            expect(keytar.setPassword).not.toHaveBeenCalled();
        });

        test('nullキー名でエラーを返す', async () => {
            const result = await keychainManager.saveAPIKey(null, 'test_value');

            expect(result).toBe(false);
            expect(keytar.setPassword).not.toHaveBeenCalled();
        });

        test('空のキー値でエラーを返す', async () => {
            const result = await keychainManager.saveAPIKey('test_key', '');

            expect(result).toBe(false);
            expect(keytar.setPassword).not.toHaveBeenCalled();
        });

        test('keytar例外が発生した場合falseを返す', async () => {
            keytar.setPassword.mockRejectedValue(new Error('Keychain access denied'));

            const result = await keychainManager.saveAPIKey('test_key', 'test_value');

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('getAPIKey', () => {
        test('存在するAPIキーを取得できる', async () => {
            keytar.getPassword.mockResolvedValue('test_value');

            const result = await keychainManager.getAPIKey('test_key');

            expect(result).toBe('test_value');
            expect(keytar.getPassword).toHaveBeenCalledWith('Test Service', 'test_key');
            expect(keytar.getPassword).toHaveBeenCalledTimes(1);
        });

        test('存在しないAPIキーでnullを返す', async () => {
            keytar.getPassword.mockResolvedValue(null);

            const result = await keychainManager.getAPIKey('nonexistent_key');

            expect(result).toBe(null);
            expect(keytar.getPassword).toHaveBeenCalledWith('Test Service', 'nonexistent_key');
        });

        test('空のキー名でnullを返す', async () => {
            const result = await keychainManager.getAPIKey('');

            expect(result).toBe(null);
            expect(keytar.getPassword).not.toHaveBeenCalled();
        });

        test('keytar例外が発生した場合nullを返す', async () => {
            keytar.getPassword.mockRejectedValue(new Error('Keychain access denied'));

            const result = await keychainManager.getAPIKey('test_key');

            expect(result).toBe(null);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('deleteAPIKey', () => {
        test('存在するAPIキーを削除できる', async () => {
            keytar.getPassword.mockResolvedValue('existing_value');
            keytar.deletePassword.mockResolvedValue(true);

            const result = await keychainManager.deleteAPIKey('test_key');

            expect(result).toBe(true);
            expect(keytar.getPassword).toHaveBeenCalledWith('Test Service', 'test_key');
            expect(keytar.deletePassword).toHaveBeenCalledWith('Test Service', 'test_key');
        });

        test('存在しないAPIキーの削除でtrueを返す', async () => {
            keytar.getPassword.mockResolvedValue(null);

            const result = await keychainManager.deleteAPIKey('nonexistent_key');

            expect(result).toBe(true);
            expect(keytar.getPassword).toHaveBeenCalledWith('Test Service', 'nonexistent_key');
            expect(keytar.deletePassword).not.toHaveBeenCalled();
        });

        test('空のキー名でfalseを返す', async () => {
            const result = await keychainManager.deleteAPIKey('');

            expect(result).toBe(false);
            expect(keytar.getPassword).not.toHaveBeenCalled();
            expect(keytar.deletePassword).not.toHaveBeenCalled();
        });

        test('削除に失敗した場合falseを返す', async () => {
            keytar.getPassword.mockResolvedValue('existing_value');
            keytar.deletePassword.mockResolvedValue(false);

            const result = await keychainManager.deleteAPIKey('test_key');

            expect(result).toBe(false);
        });

        test('keytar例外が発生した場合falseを返す', async () => {
            keytar.getPassword.mockRejectedValue(new Error('Keychain access denied'));

            const result = await keychainManager.deleteAPIKey('test_key');

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('hasAPIKey', () => {
        test('存在するキーでtrueを返す', async () => {
            keytar.getPassword.mockResolvedValue('test_value');

            const result = await keychainManager.hasAPIKey('test_key');

            expect(result).toBe(true);
        });

        test('存在しないキーでfalseを返す', async () => {
            keytar.getPassword.mockResolvedValue(null);

            const result = await keychainManager.hasAPIKey('nonexistent_key');

            expect(result).toBe(false);
        });
    });

    describe('getAllAPIKeyNames', () => {
        test('すべてのAPIキー名を取得できる', async () => {
            const mockCredentials = [
                { account: 'key1', password: 'value1' },
                { account: 'key2', password: 'value2' },
                { account: 'key3', password: 'value3' }
            ];
            keytar.findCredentials.mockResolvedValue(mockCredentials);

            const result = await keychainManager.getAllAPIKeyNames();

            expect(result).toEqual(['key1', 'key2', 'key3']);
            expect(keytar.findCredentials).toHaveBeenCalledWith('Test Service');
        });

        test('キーが存在しない場合空配列を返す', async () => {
            keytar.findCredentials.mockResolvedValue([]);

            const result = await keychainManager.getAllAPIKeyNames();

            expect(result).toEqual([]);
        });

        test('keytar例外が発生した場合空配列を返す', async () => {
            keytar.findCredentials.mockRejectedValue(new Error('Keychain access denied'));

            const result = await keychainManager.getAllAPIKeyNames();

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('validateAPIKeyFormat', () => {
        test('有効なAPIキーでtrueを返す', () => {
            const result = keychainManager.validateAPIKeyFormat('valid_api_key_12345');

            expect(result).toBe(true);
        });

        test('短すぎるAPIキーでfalseを返す', () => {
            const result = keychainManager.validateAPIKeyFormat('short');

            expect(result).toBe(false);
        });

        test('長すぎるAPIキーでfalseを返す', () => {
            const longKey = 'a'.repeat(201);
            const result = keychainManager.validateAPIKeyFormat(longKey);

            expect(result).toBe(false);
        });

        test('無効な文字を含むAPIキーでfalseを返す', () => {
            const result = keychainManager.validateAPIKeyFormat('invalid@key#with$special%chars');

            expect(result).toBe(false);
        });

        test('空文字列でfalseを返す', () => {
            const result = keychainManager.validateAPIKeyFormat('');

            expect(result).toBe(false);
        });

        test('nullでfalseを返す', () => {
            const result = keychainManager.validateAPIKeyFormat(null);

            expect(result).toBe(false);
        });

        test('カスタムオプションで検証できる', () => {
            const result = keychainManager.validateAPIKeyFormat('abc', {
                minLength: 2,
                maxLength: 5,
                pattern: /^[abc]+$/
            });

            expect(result).toBe(true);
        });
    });

    describe('DeepL API ヘルパーメソッド', () => {
        describe('saveDeepLAPIKey', () => {
            test('有効なDeepL APIキーを保存できる', async () => {
                keytar.setPassword.mockResolvedValue(true);
                const validDeepLKey = '12345678-1234-1234-1234-123456789abc:fx';

                const result = await keychainManager.saveDeepLAPIKey(validDeepLKey);

                expect(result).toBe(true);
                expect(keytar.setPassword).toHaveBeenCalledWith('Test Service', 'deepl_api_key', validDeepLKey);
            });

            test('無効なDeepL APIキー形式でfalseを返す', async () => {
                const invalidKey = 'invalid_deepl_key';

                const result = await keychainManager.saveDeepLAPIKey(invalidKey);

                expect(result).toBe(false);
                expect(keytar.setPassword).not.toHaveBeenCalled();
            });
        });

        describe('getDeepLAPIKey', () => {
            test('DeepL APIキーを取得できる', async () => {
                const expectedKey = '12345678-1234-1234-1234-123456789abc:fx';
                keytar.getPassword.mockResolvedValue(expectedKey);

                const result = await keychainManager.getDeepLAPIKey();

                expect(result).toBe(expectedKey);
                expect(keytar.getPassword).toHaveBeenCalledWith('Test Service', 'deepl_api_key');
            });
        });

        describe('deleteDeepLAPIKey', () => {
            test('DeepL APIキーを削除できる', async () => {
                keytar.getPassword.mockResolvedValue('some_value');
                keytar.deletePassword.mockResolvedValue(true);

                const result = await keychainManager.deleteDeepLAPIKey();

                expect(result).toBe(true);
                expect(keytar.deletePassword).toHaveBeenCalledWith('Test Service', 'deepl_api_key');
            });
        });
    });

    describe('healthCheck', () => {
        test('健全性チェックが成功する', async () => {
            keytar.setPassword.mockResolvedValue(true);
            keytar.getPassword.mockResolvedValue('test_value');
            keytar.deletePassword.mockResolvedValue(true);

            const result = await keychainManager.healthCheck();

            expect(result.status).toBe('healthy');
            expect(result.checks.keytarAvailable).toBe(true);
            expect(result.checks.keychainAccessible).toBe(true);
            expect(result.checks.serviceExists).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('keytar例外が発生した場合unhealthyを返す', async () => {
            keytar.setPassword.mockRejectedValue(new Error('Keychain access denied'));

            const result = await keychainManager.healthCheck();

            expect(result.status).toBe('unhealthy');
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
});