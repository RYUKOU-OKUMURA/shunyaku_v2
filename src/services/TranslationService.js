/**
 * TranslationService.js
 *
 * DeepL APIを使用した翻訳サービスクラス
 * エラーハンドリング、リトライロジック、使用量管理機能を含む
 *
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const { Translator } = require('deepl-node');
const KeychainManager = require('./KeychainManager');

class TranslationService {
  /**
   * TranslationServiceインスタンスを作成
   * @param {Object} options - 設定オプション
   * @param {number} options.maxRetries - 最大リトライ回数（デフォルト: 3）
   * @param {number} options.initialRetryDelay - 初期リトライ遅延時間ms（デフォルト: 1000）
   * @param {number} options.maxRetryDelay - 最大リトライ遅延時間ms（デフォルト: 30000）
   * @param {number} options.timeout - リクエストタイムアウトms（デフォルト: 30000）
   */
  constructor(options = {}) {
    const {
      maxRetries = 3,
      initialRetryDelay = 1000,
      maxRetryDelay = 30000,
      timeout = 30000,
    } = options;

    this.maxRetries = maxRetries;
    this.initialRetryDelay = initialRetryDelay;
    this.maxRetryDelay = maxRetryDelay;
    this.timeout = timeout;

    this.translator = null;
    this.keychainManager = new KeychainManager();
    this.logger = console; // 後でロガーサービスと統合可能
    this.usageStats = {
      charactersTranslated: 0,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  /**
   * DeepL APIクライアントを初期化する
   * @returns {Promise<boolean>} 初期化に成功した場合true、失敗した場合false
   */
  async initialize() {
    try {
      // KeychainからAPIキーを取得
      const apiKey = await this.keychainManager.getDeepLAPIKey();

      if (!apiKey) {
        throw new Error(
          'DeepL APIキーがKeychainに見つかりません。設定画面でAPIキーを入力してください。',
        );
      }

      // Translatorインスタンスを作成
      this.translator = new Translator(apiKey, {
        timeout: this.timeout,
        // DeepLサーバーのURL（無料版は自動設定、Pro版では必要に応じて設定）
        serverUrl: apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com',
      });

      // 接続テストを実行
      await this.healthCheck();

      this.logger.log('[TranslationService] DeepL APIクライアントの初期化が完了しました');
      return true;
    } catch (error) {
      this.logger.error(`[TranslationService] 初期化エラー: ${error.message}`, error);
      this.translator = null;
      return false;
    }
  }

  /**
   * APIクライアントが初期化されているかチェックする
   * @returns {boolean} 初期化されている場合true
   */
  isInitialized() {
    return this.translator !== null;
  }

  /**
   * テキストを翻訳する（基本メソッド）
   * @param {string} text - 翻訳するテキスト
   * @param {string} targetLanguage - 翻訳先言語コード（例: 'ja', 'en-us'）
   * @param {string|null} sourceLanguage - 翻訳元言語コード（nullで自動検出）
   * @param {Object} options - 翻訳オプション
   * @param {string} options.formality - 敬語レベル（'more', 'less', 'default', 'prefer_more', 'prefer_less'）
   * @param {boolean} options.preserveFormatting - フォーマット保持（デフォルト: true）
   * @param {string} options.tagHandling - タグ処理方法（'xml', 'html'）
   * @returns {Promise<Object>} 翻訳結果オブジェクト
   */
  async translate(text, targetLanguage, sourceLanguage = null, options = {}) {
    // 前処理とバリデーション
    const validationResult = this._validateTranslationRequest(text, targetLanguage);
    if (!validationResult.isValid) {
      throw new Error(`翻訳リクエストが無効です: ${validationResult.error}`);
    }

    // 初期化チェック
    if (!this.isInitialized()) {
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error('DeepL APIクライアントの初期化に失敗しました');
      }
    }

    // リトライロジック付きで翻訳実行
    return await this._translateWithRetry(text, targetLanguage, sourceLanguage, options);
  }

  /**
   * リトライロジック付きの翻訳実行
   * @private
   * @param {string} text - 翻訳するテキスト
   * @param {string} targetLanguage - 翻訳先言語コード
   * @param {string|null} sourceLanguage - 翻訳元言語コード
   * @param {Object} options - 翻訳オプション
   * @returns {Promise<Object>} 翻訳結果
   */
  async _translateWithRetry(text, targetLanguage, sourceLanguage, options) {
    let lastError = null;
    let retryDelay = this.initialRetryDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.usageStats.requestCount++;

        const startTime = Date.now();

        // DeepL API呼び出し
        const translationOptions = {
          formality: options.formality || 'default',
          preserveFormatting: options.preserveFormatting !== false,
          ...(options.tagHandling && { tagHandling: options.tagHandling }),
        };

        const results = await this.translator.translateText(
          text,
          sourceLanguage,
          targetLanguage,
          translationOptions,
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        // 統計更新
        this.usageStats.successCount++;
        this.usageStats.charactersTranslated += text.length;

        // 結果の構築
        const translationResult = {
          originalText: text,
          translatedText: results.text,
          sourceLanguage: results.detectedSourceLang || sourceLanguage,
          targetLanguage: targetLanguage,
          duration: duration,
          timestamp: new Date().toISOString(),
          usage: {
            charactersCount: text.length,
            billedCharacters: text.length, // DeepLの実際の課金文字数は応答から取得可能
          },
        };

        this.logger.log(`[TranslationService] 翻訳成功: ${text.length}文字, ${duration}ms`);
        return translationResult;
      } catch (error) {
        lastError = error;
        this.usageStats.errorCount++;

        // リトライ可能エラーかチェック
        const shouldRetry = this._shouldRetryError(error);

        if (!shouldRetry || attempt === this.maxRetries) {
          // リトライ不可能またはリトライ回数上限
          break;
        }

        // 指数バックオフでリトライ待機
        this.logger.warn(
          `[TranslationService] 翻訳失敗（試行${attempt + 1}/${this.maxRetries + 1}）: ${error.message}, ${retryDelay}ms後にリトライします`,
        );

        await this._sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, this.maxRetryDelay);
      }
    }

    // すべてのリトライが失敗した場合
    const errorMessage = `翻訳に失敗しました（${this.maxRetries + 1}回試行）: ${lastError?.message || '不明なエラー'}`;
    this.logger.error(`[TranslationService] ${errorMessage}`, lastError);
    throw new Error(errorMessage);
  }

  /**
   * エラーがリトライ可能かどうかを判断する
   * @private
   * @param {Error} error - チェックするエラー
   * @returns {boolean} リトライ可能な場合true
   */
  _shouldRetryError(error) {
    // DeepLのエラーコードに基づいた判定
    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.statusCode || error.status;

    // リトライ可能な条件
    const retryableConditions = [
      // HTTP ステータスコード
      statusCode === 429, // Too Many Requests
      statusCode === 500, // Internal Server Error
      statusCode === 502, // Bad Gateway
      statusCode === 503, // Service Unavailable
      statusCode === 504, // Gateway Timeout

      // ネットワークエラー
      errorMessage.includes('timeout'),
      errorMessage.includes('network error'),
      errorMessage.includes('connection reset'),
      errorMessage.includes('enotfound'),
      errorMessage.includes('econnreset'),
      errorMessage.includes('etimedout'),
    ];

    return retryableConditions.some((condition) => condition === true);
  }

  /**
   * 翻訳リクエストの妥当性を検証する
   * @private
   * @param {string} text - 翻訳するテキスト
   * @param {string} targetLanguage - 翻訳先言語コード
   * @returns {Object} 検証結果
   */
  _validateTranslationRequest(text, targetLanguage) {
    // テキストの検証
    if (typeof text !== 'string') {
      return { isValid: false, error: '翻訳するテキストが無効です' };
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return { isValid: false, error: '翻訳するテキストが空です' };
    }

    if (trimmedText.length > 5000) {
      return { isValid: false, error: 'テキストが長すぎます（最大5000文字）' };
    }

    // 言語コードの検証
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return { isValid: false, error: '翻訳先言語コードが無効です' };
    }

    const supportedLanguages = [
      'bg',
      'cs',
      'da',
      'de',
      'el',
      'en',
      'en-gb',
      'en-us',
      'es',
      'et',
      'fi',
      'fr',
      'hu',
      'id',
      'it',
      'ja',
      'ko',
      'lt',
      'lv',
      'nb',
      'nl',
      'pl',
      'pt',
      'pt-br',
      'pt-pt',
      'ro',
      'ru',
      'sk',
      'sl',
      'sv',
      'tr',
      'uk',
      'zh',
    ];

    if (!supportedLanguages.includes(targetLanguage.toLowerCase())) {
      return { isValid: false, error: `サポートされていない翻訳先言語です: ${targetLanguage}` };
    }

    return { isValid: true };
  }

  /**
   * 指定された時間だけ待機する
   * @private
   * @param {number} ms - 待機時間（ミリ秒）
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * DeepL APIの使用量を取得する
   * @returns {Promise<Object>} 使用量情報
   */
  async getUsage() {
    try {
      if (!this.isInitialized()) {
        throw new Error('TranslationServiceが初期化されていません');
      }

      const usage = await this.translator.getUsage();

      return {
        character: {
          count: usage.character?.count || 0,
          limit: usage.character?.limit || 0,
        },
        document: {
          count: usage.document?.count || 0,
          limit: usage.document?.limit || 0,
        },
        teamDocument: {
          count: usage.teamDocument?.count || 0,
          limit: usage.teamDocument?.limit || 0,
        },
        localStats: this.usageStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[TranslationService] 使用量取得エラー: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * サポートされている言語一覧を取得する
   * @returns {Promise<Object>} 言語一覧
   */
  async getSupportedLanguages() {
    try {
      if (!this.isInitialized()) {
        const initResult = await this.initialize();
        if (!initResult) {
          throw new Error('DeepL APIクライアントの初期化に失敗しました');
        }
      }

      const sourceLanguages = await this.translator.getSourceLanguages();
      const targetLanguages = await this.translator.getTargetLanguages();

      return {
        source: sourceLanguages.map((lang) => ({
          code: lang.code,
          name: lang.name,
        })),
        target: targetLanguages.map((lang) => ({
          code: lang.code,
          name: lang.name,
          supportsFormality: lang.supportsFormality || false,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[TranslationService] 言語一覧取得エラー: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * TranslationServiceの健全性をチェックする
   * @returns {Promise<Object>} ヘルスチェック結果
   */
  async healthCheck() {
    const result = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        initialized: this.isInitialized(),
        apiKeyExists: false,
        apiConnection: false,
        usageAccessible: false,
      },
      errors: [],
      stats: this.usageStats,
    };

    try {
      // APIキー存在チェック
      const hasAPIKey = await this.keychainManager.hasAPIKey('deepl_api_key');
      result.checks.apiKeyExists = hasAPIKey;

      if (!hasAPIKey) {
        throw new Error('DeepL APIキーがKeychainに設定されていません');
      }

      // 初期化チェック
      if (!this.isInitialized()) {
        const initResult = await this.initialize();
        if (!initResult) {
          throw new Error('DeepL APIクライアントの初期化に失敗しました');
        }
      }
      result.checks.initialized = this.isInitialized();

      // API接続テスト（使用量取得で代用）
      try {
        await this.getUsage();
        result.checks.apiConnection = true;
        result.checks.usageAccessible = true;
      } catch (error) {
        throw new Error(`DeepL API接続テスト失敗: ${error.message}`);
      }
    } catch (error) {
      result.status = 'unhealthy';
      result.errors.push(error.message);
      this.logger.error(`[TranslationService] ヘルスチェック失敗: ${error.message}`, error);
    }

    return result;
  }

  /**
   * 統計情報をリセットする
   */
  resetStats() {
    this.usageStats = {
      charactersTranslated: 0,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
    };
    this.logger.log('[TranslationService] 統計情報をリセットしました');
  }

  /**
   * APIキーをテストして接続を確認する
   * @param {string} apiKey - テストするAPIキー
   * @returns {Promise<Object>} テスト結果
   */
  async testConnection(apiKey) {
    try {
      // テンポラリなTranslatorインスタンスを作成
      const testTranslator = new Translator(apiKey);

      // API接続テスト（使用量取得）
      const usage = await testTranslator.getUsage();

      // 簡単な翻訳テスト
      const testResult = await testTranslator.translateText('Hello', null, 'ja');

      return {
        success: true,
        usage: {
          character: usage.character,
          document: usage.document,
        },
        testTranslation: {
          original: 'Hello',
          translated: testResult.text,
          detectedLanguage: testResult.detectedSourceLang,
        },
      };
    } catch (error) {
      this.logger.error(`[TranslationService] API接続テスト失敗: ${error.message}`, error);

      // エラーの種類を判定
      let errorType = 'unknown';
      let userMessage = 'Unknown error occurred';

      if (error.message.includes('401') || error.message.includes('403')) {
        errorType = 'auth';
        userMessage = 'Invalid API key. Please check your DeepL API key.';
      } else if (error.message.includes('429')) {
        errorType = 'quota';
        userMessage = 'API quota exceeded. Please try again later.';
      } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
        errorType = 'network';
        userMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('456')) {
        errorType = 'quota';
        userMessage = 'DeepL API quota exceeded for this month.';
      }

      return {
        success: false,
        error: error.message,
        errorType,
        userMessage,
      };
    }
  }

  /**
   * リソースをクリーンアップする
   */
  async cleanup() {
    try {
      this.translator = null;
      this.logger.log('[TranslationService] リソースをクリーンアップしました');
    } catch (error) {
      this.logger.error(`[TranslationService] クリーンアップエラー: ${error.message}`, error);
    }
  }
}

module.exports = TranslationService;
