/**
 * KeychainManager.integration.test.js
 * 
 * KeychainManagerの実際のKeychain連携テスト
 * 実際のKeychainを使用した統合テスト（macOS環境でのみ実行）
 * 
 * 注意: このテストは実際のKeychainに一時的にデータを保存します
 */

const KeychainManager = require('../src/services/KeychainManager');

describe('KeychainManager Integration Test', () => {
    let keychainManager;
    const testServiceName = 'Shunyaku v2 Test';
    const testKeyName = 'test_integration_key';
    const testKeyValue = 'test_integration_value_' + Date.now();

    beforeAll(() => {
        keychainManager = new KeychainManager(testServiceName);
    });

    afterAll(async () => {
        // テスト後のクリーンアップ
        try {
            await keychainManager.deleteAPIKey(testKeyName);
            await keychainManager.deleteDeepLAPIKey();
        } catch (error) {
            console.warn('クリーンアップ中にエラーが発生しました:', error.message);
        }
    });

    test('Keychainとの基本的な連携動作確認', async () => {
        // 1. APIキーを保存
        const saveResult = await keychainManager.saveAPIKey(testKeyName, testKeyValue);
        expect(saveResult).toBe(true);

        // 2. APIキーを取得
        const retrievedValue = await keychainManager.getAPIKey(testKeyName);
        expect(retrievedValue).toBe(testKeyValue);

        // 3. APIキー存在確認
        const hasKey = await keychainManager.hasAPIKey(testKeyName);
        expect(hasKey).toBe(true);

        // 4. APIキー一覧取得
        const keyNames = await keychainManager.getAllAPIKeyNames();
        expect(keyNames).toContain(testKeyName);

        // 5. APIキーを削除
        const deleteResult = await keychainManager.deleteAPIKey(testKeyName);
        expect(deleteResult).toBe(true);

        // 6. 削除後の確認
        const retrievedAfterDelete = await keychainManager.getAPIKey(testKeyName);
        expect(retrievedAfterDelete).toBe(null);

        // 7. 削除後の存在確認
        const hasKeyAfterDelete = await keychainManager.hasAPIKey(testKeyName);
        expect(hasKeyAfterDelete).toBe(false);
    }, 10000); // 10秒のタイムアウト

    test('DeepL APIキー専用メソッドの動作確認', async () => {
        const testDeepLKey = '12345678-1234-1234-1234-123456789abc:fx';

        // 1. DeepL APIキーを保存
        const saveResult = await keychainManager.saveDeepLAPIKey(testDeepLKey);
        expect(saveResult).toBe(true);

        // 2. DeepL APIキーを取得
        const retrievedKey = await keychainManager.getDeepLAPIKey();
        expect(retrievedKey).toBe(testDeepLKey);

        // 3. DeepL APIキーを削除
        const deleteResult = await keychainManager.deleteDeepLAPIKey();
        expect(deleteResult).toBe(true);

        // 4. 削除後の確認
        const retrievedAfterDelete = await keychainManager.getDeepLAPIKey();
        expect(retrievedAfterDelete).toBe(null);
    }, 10000);

    test('KeychainManagerヘルスチェック', async () => {
        const healthResult = await keychainManager.healthCheck();
        
        expect(healthResult).toHaveProperty('status');
        expect(healthResult).toHaveProperty('timestamp');
        expect(healthResult).toHaveProperty('checks');
        expect(healthResult.checks).toHaveProperty('keytarAvailable');
        expect(healthResult.checks).toHaveProperty('keychainAccessible');
        expect(healthResult.checks).toHaveProperty('serviceExists');

        // macOS環境では基本的にhealthyになるはず
        console.log('Health Check Result:', JSON.stringify(healthResult, null, 2));
    }, 10000);
});