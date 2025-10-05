/**
 * KeychainManager.js
 *
 * macOSのKeychainを使用してAPIキーなど機密情報を安全に管理するクラス
 * keytarライブラリを使用してmacOSのKeychain Servicesと連携
 *
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const keytar = require('keytar');

class KeychainManager {
  /**
   * KeychainManagerインスタンスを作成
   * @param {string} serviceName - Keychainに保存する際のサービス名（デフォルト: 'Shunyaku v2'）
   */
  constructor(serviceName = 'Shunyaku v2') {
    this.serviceName = serviceName;
    this.logger = console; // 後でロガーサービスと統合可能
  }

  /**
   * APIキーをKeychainに保存する
   * @param {string} keyName - APIキーの識別名（例: 'deepl_api_key'）
   * @param {string} keyValue - 保存するAPIキー
   * @returns {Promise<boolean>} 保存に成功した場合true、失敗した場合false
   */
  async saveAPIKey(keyName, keyValue) {
    try {
      // 入力値の検証
      if (!keyName || typeof keyName !== 'string' || keyName.trim() === '') {
        throw new Error('APIキー名が無効です。空でない文字列を指定してください。');
      }

      if (!keyValue || typeof keyValue !== 'string' || keyValue.trim() === '') {
        throw new Error('APIキー値が無効です。空でない文字列を指定してください。');
      }

      // Keychainに保存
      await keytar.setPassword(this.serviceName, keyName, keyValue);

      this.logger.log(`[KeychainManager] APIキー '${keyName}' をKeychainに保存しました`);
      return true;
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキー保存エラー: ${error.message}`, error);
      return false;
    }
  }

  /**
   * KeychainからAPIキーを取得する
   * @param {string} keyName - 取得するAPIキーの識別名
   * @returns {Promise<string|null>} APIキー値、見つからない場合はnull
   */
  async getAPIKey(keyName) {
    try {
      // 入力値の検証
      if (!keyName || typeof keyName !== 'string' || keyName.trim() === '') {
        throw new Error('APIキー名が無効です。空でない文字列を指定してください。');
      }

      // Keychainから取得
      const keyValue = await keytar.getPassword(this.serviceName, keyName);

      if (keyValue) {
        this.logger.log(`[KeychainManager] APIキー '${keyName}' をKeychainから取得しました`);
        return keyValue;
      } else {
        this.logger.log(`[KeychainManager] APIキー '${keyName}' はKeychainに見つかりませんでした`);
        return null;
      }
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキー取得エラー: ${error.message}`, error);
      return null;
    }
  }

  /**
   * KeychainからAPIキーを削除する
   * @param {string} keyName - 削除するAPIキーの識別名
   * @returns {Promise<boolean>} 削除に成功した場合true、失敗した場合false
   */
  async deleteAPIKey(keyName) {
    try {
      // 入力値の検証
      if (!keyName || typeof keyName !== 'string' || keyName.trim() === '') {
        throw new Error('APIキー名が無効です。空でない文字列を指定してください。');
      }

      // 削除前に存在確認
      const existingKey = await keytar.getPassword(this.serviceName, keyName);
      if (!existingKey) {
        this.logger.log(
          `[KeychainManager] APIキー '${keyName}' は存在しないため削除をスキップしました`
        );
        return true; // 存在しない場合も削除成功とみなす
      }

      // Keychainから削除
      const deleted = await keytar.deletePassword(this.serviceName, keyName);

      if (deleted) {
        this.logger.log(`[KeychainManager] APIキー '${keyName}' をKeychainから削除しました`);
        return true;
      } else {
        this.logger.warn(`[KeychainManager] APIキー '${keyName}' の削除に失敗しました`);
        return false;
      }
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキー削除エラー: ${error.message}`, error);
      return false;
    }
  }

  /**
   * 指定されたAPIキーがKeychainに存在するかチェックする
   * @param {string} keyName - チェックするAPIキーの識別名
   * @returns {Promise<boolean>} キーが存在する場合true、存在しない場合false
   */
  async hasAPIKey(keyName) {
    try {
      const keyValue = await this.getAPIKey(keyName);
      return keyValue !== null;
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキー存在チェックエラー: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Keychainに保存されているこのサービスのすべてのAPIキー名を取得する
   * @returns {Promise<string[]>} APIキー名の配列
   */
  async getAllAPIKeyNames() {
    try {
      const credentials = await keytar.findCredentials(this.serviceName);
      const keyNames = credentials.map((credential) => credential.account);

      this.logger.log(`[KeychainManager] ${keyNames.length}個のAPIキーを発見しました`);
      return keyNames;
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキー一覧取得エラー: ${error.message}`, error);
      return [];
    }
  }

  /**
   * APIキーが有効な形式かどうかを基本的なチェックで検証する
   * @param {string} keyValue - チェックするAPIキー値
   * @param {Object} options - 検証オプション
   * @param {number} options.minLength - 最小長（デフォルト: 10）
   * @param {number} options.maxLength - 最大長（デフォルト: 200）
   * @param {RegExp} options.pattern - 許可される文字パターン
   * @returns {boolean} 有効な場合true、無効な場合false
   */
  validateAPIKeyFormat(keyValue, options = {}) {
    try {
      const { minLength = 10, maxLength = 200, pattern = /^[a-zA-Z0-9_\-.:]+$/ } = options;

      if (!keyValue || typeof keyValue !== 'string') {
        return false;
      }

      const trimmedKey = keyValue.trim();

      // 長さチェック
      if (trimmedKey.length < minLength || trimmedKey.length > maxLength) {
        return false;
      }

      // パターンチェック
      if (!pattern.test(trimmedKey)) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`[KeychainManager] APIキーフォーマット検証エラー: ${error.message}`, error);
      return false;
    }
  }

  /**
   * DeepL API専用のヘルパーメソッド：APIキーを保存
   * @param {string} apiKey - DeepL APIキー
   * @returns {Promise<boolean>} 保存に成功した場合true
   */
  async saveDeepLAPIKey(apiKey) {
    // DeepL APIキーの基本的な検証
    if (
      !this.validateAPIKeyFormat(apiKey, {
        minLength: 20,
        maxLength: 100,
        pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:fx$/,
      })
    ) {
      this.logger.error('[KeychainManager] DeepL APIキーの形式が無効です');
      return false;
    }

    return await this.saveAPIKey('deepl_api_key', apiKey);
  }

  /**
   * DeepL API専用のヘルパーメソッド：APIキーを取得
   * @returns {Promise<string|null>} DeepL APIキー
   */
  async getDeepLAPIKey() {
    return await this.getAPIKey('deepl_api_key');
  }

  /**
   * DeepL API専用のヘルパーメソッド：APIキーを削除
   * @returns {Promise<boolean>} 削除に成功した場合true
   */
  async deleteDeepLAPIKey() {
    return await this.deleteAPIKey('deepl_api_key');
  }

  /**
   * KeychainManagerの健全性をチェックする
   * @returns {Promise<Object>} ヘルスチェック結果
   */
  async healthCheck() {
    const result = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        keytarAvailable: false,
        keychainAccessible: false,
        serviceExists: false,
      },
      errors: [],
    };

    try {
      // keytar利用可能性チェック
      if (keytar && typeof keytar.getPassword === 'function') {
        result.checks.keytarAvailable = true;
      } else {
        throw new Error('keytarライブラリが利用できません');
      }

      // Keychain接続テスト（ダミーキーで）
      const testKey = '__health_check__';
      await keytar.setPassword(this.serviceName, testKey, 'test_value');
      const retrieved = await keytar.getPassword(this.serviceName, testKey);
      await keytar.deletePassword(this.serviceName, testKey);

      if (retrieved === 'test_value') {
        result.checks.keychainAccessible = true;
        result.checks.serviceExists = true;
      }
    } catch (error) {
      result.status = 'unhealthy';
      result.errors.push(error.message);
      this.logger.error(`[KeychainManager] ヘルスチェック失敗: ${error.message}`, error);
    }

    return result;
  }
}

module.exports = KeychainManager;
