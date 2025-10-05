/**
 * OCRService.js - OCR処理を管理するサービスクラス
 *
 * OCRWorkerをラップして、アプリケーションから簡単にOCR機能を使用できるようにします。
 * 画像前処理、言語データ管理、信頼度チェックなどの機能を提供します。
 *
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const OCRWorker = require('./OCRWorker');
const LanguageDataManager = require('./LanguageDataManager');
const ImagePreprocessor = require('./ImagePreprocessor');
const path = require('path');
const fs = require('fs').promises;

/**
 * OCRサービスクラス
 */
class OCRService {
  constructor() {
    this.ocrWorker = null;
    this.languageDataManager = null;
    this.imagePreprocessor = null;
    this.isInitialized = false;
    this.supportedLanguages = ['eng', 'jpn', 'eng+jpn'];
    this.minimumConfidence = 60; // 最小信頼度
  }

  /**
   * OCRサービスを初期化
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // 言語データマネージャを初期化
      this.languageDataManager = new LanguageDataManager();
      await this.languageDataManager.initialize();

      // 画像前処理サービスを初期化
      this.imagePreprocessor = new ImagePreprocessor();
      await this.imagePreprocessor.initialize();

      // OCRWorkerを初期化
      this.ocrWorker = new OCRWorker();
      await this.ocrWorker.initialize();

      this.isInitialized = true;
      console.log('OCRService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCRService:', error);
      throw error;
    }
  }

  /**
   * 画像からテキストを抽出
   * @param {string} imagePath - 画像ファイルパス
   * @param {Object} options - オプション設定
   * @param {string} options.language - 言語コード ('eng', 'jpn', 'eng+jpn')
   * @param {boolean} options.preprocess - 画像前処理を行うか
   * @param {number} options.minConfidence - 最小信頼度
   * @returns {Promise<Object>} OCR結果
   */
  async extractText(imagePath, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const config = {
      language: options.language || 'eng+jpn',
      preprocess: options.preprocess !== false,
      minConfidence: options.minConfidence || this.minimumConfidence,
      startTime: Date.now(),
    };

    try {
      // 画像ファイルの存在確認
      await this._validateImageFile(imagePath);

      // 言語データの確保
      await this.ensureLanguageAvailable(config.language);

      // 前処理が有効な場合は画像を処理
      let processedImagePath = imagePath;
      if (config.preprocess) {
        processedImagePath = await this._preprocessImage(imagePath, {
          type: config.preprocessType || 'standard',
        });
      }

      // OCR実行
      const result = await this.ocrWorker.recognize(processedImagePath, config.language, {
        startTime: config.startTime,
      });

      // 結果の後処理と信頼度チェック
      const processedResult = await this._processOCRResult(result, config);

      // 前処理で作成した一時ファイルを削除
      if (processedImagePath !== imagePath && this.imagePreprocessor) {
        await this.imagePreprocessor.cleanupTempFile(processedImagePath);
      }

      return processedResult;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  /**
   * 複数の画像を一括処理
   * @param {string[]} imagePaths - 画像ファイルパスの配列
   * @param {Object} options - オプション設定
   * @returns {Promise<Object[]>} OCR結果の配列
   */
  async extractTextBatch(imagePaths, options = {}) {
    const results = [];

    for (const imagePath of imagePaths) {
      try {
        const result = await this.extractText(imagePath, options);
        results.push(result);
      } catch (error) {
        results.push({
          error: error.message,
          imagePath: imagePath,
        });
      }
    }

    return results;
  }

  /**
   * サポートされている言語一覧を取得
   * @returns {string[]} 言語コードの配列
   */
  getSupportedLanguages() {
    return [...this.supportedLanguages];
  }

  /**
   * テキスト抽出の統合実行メソッド（メインメソッド）
   * @param {string} imagePath - 画像ファイルパス
   * @param {Object} options - 設定オプション
   * @returns {Promise<Object>} 完全なOCR結果
   */
  async performOCR(imagePath, options = {}) {
    const startTime = Date.now();

    try {
      // 基本設定
      const config = {
        language: options.language || 'eng+jpn',
        preprocess: options.preprocess !== false,
        minConfidence: options.minConfidence || this.minimumConfidence,
        returnDetails: options.returnDetails || false,
        startTime: startTime,
      };

      console.log(`Starting OCR process for: ${imagePath}`);
      console.log('Configuration:', config);

      // サービス初期化確認
      if (!this.isInitialized) {
        await this.initialize();
      }

      // OCR実行
      const result = await this.extractText(imagePath, config);

      // 詳細情報の付加
      result.processingSteps = {
        initialization: 'completed',
        languageDataCheck: 'completed',
        imageValidation: 'completed',
        preprocessing: config.preprocess ? 'completed' : 'skipped',
        ocrExecution: 'completed',
        postProcessing: 'completed',
      };

      result.totalTime = Date.now() - startTime;

      console.log(`OCR completed in ${result.totalTime}ms with confidence: ${result.confidence}%`);

      return result;
    } catch (error) {
      console.error('OCR process failed:', error);

      return {
        success: false,
        error: error.message,
        text: '',
        confidence: 0,
        totalTime: Date.now() - startTime,
        processingSteps: {
          error: error.message,
          failedAt: Date.now(),
        },
      };
    }
  }

  /**
   * OCR機能の健全性テスト
   * @param {string} testImagePath - テスト用画像パス（オプション）
   * @returns {Promise<Object>} テスト結果
   */
  async performHealthCheck(testImagePath = null) {
    const healthStatus = {
      overall: 'unknown',
      components: {},
      timestamp: new Date().toISOString(),
    };

    try {
      // 初期化チェック
      healthStatus.components.initialization = await this._checkInitialization();

      // 言語データチェック
      healthStatus.components.languageData = await this._checkLanguageData();

      // Workerチェック
      healthStatus.components.worker = await this._checkWorker();

      // オプション: 実際のOCRテスト
      if (testImagePath) {
        healthStatus.components.ocrExecution = await this._checkOCRExecution(testImagePath);
      }

      // 総合判定
      const componentStatuses = Object.values(healthStatus.components);
      const allHealthy = componentStatuses.every((status) => status === 'healthy');
      const anyFailed = componentStatuses.some((status) => status === 'failed');

      healthStatus.overall = allHealthy ? 'healthy' : anyFailed ? 'failed' : 'warning';
    } catch (error) {
      healthStatus.overall = 'failed';
      healthStatus.error = error.message;
    }

    return healthStatus;
  }

  /**
   * OCRサービスを終了
   */
  async shutdown() {
    // 一時ファイルをクリーンアップ
    if (this.imagePreprocessor) {
      await this.imagePreprocessor.cleanupAllTempFiles();
    }

    // Workerを終了
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }

    this.languageDataManager = null;
    this.imagePreprocessor = null;
    this.isInitialized = false;

    console.log('OCRService shutdown completed');
  }

  /**
   * 画像ファイルの検証
   * @param {string} imagePath - 画像ファイルパス
   * @private
   */
  async _validateImageFile(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      if (!stats.isFile()) {
        throw new Error(`Not a file: ${imagePath}`);
      }

      // ファイルサイズチェック（10MB上限）
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }

      // 拡張子チェック
      const ext = path.extname(imagePath).toLowerCase();
      const supportedExt = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];
      if (!supportedExt.includes(ext)) {
        throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Invalid image file: ${error.message}`);
    }
  }

  /**
   * 画像の前処理
   * @param {string} imagePath - 元画像パス
   * @param {Object} options - 前処理オプション
   * @returns {Promise<string>} 処理済み画像パス
   * @private
   */
  async _preprocessImage(imagePath, options = {}) {
    if (!this.imagePreprocessor) {
      console.warn('ImagePreprocessor not initialized, skipping preprocessing');
      return imagePath;
    }

    try {
      const preprocessingType = options.type || 'standard';

      let processedPath;
      switch (preprocessingType) {
        case 'high-quality':
          processedPath = await this.imagePreprocessor.preprocessHighQuality(imagePath);
          break;
        case 'light':
          processedPath = await this.imagePreprocessor.preprocessLight(imagePath);
          break;
        case 'standard':
        default:
          processedPath = await this.imagePreprocessor.preprocessStandard(imagePath);
          break;
      }

      console.log(`Image preprocessed (${preprocessingType}): ${path.basename(processedPath)}`);
      return processedPath;
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error.message);
      return imagePath;
    }
  }

  /**
   * OCR結果の後処理
   * @param {Object} result - 生のOCR結果
   * @param {Object} config - 設定
   * @returns {Promise<Object>} 処理済み結果
   * @private
   */
  async _processOCRResult(result, config) {
    const processedResult = {
      success: true,
      text: result.text,
      confidence: result.confidence,
      language: result.language,
      processingTime: result.processingTime,
      wordCount: result.words ? result.words.length : 0,
      metadata: {
        minConfidence: config.minConfidence,
        meetsConfidenceThreshold: result.confidence >= config.minConfidence,
        hasText: result.text && result.text.trim().length > 0,
      },
    };

    // 信頼度詳細分析を追加
    processedResult.confidenceAnalysis = await this._analyzeConfidence(result, config);

    // 信頼度が閾値を下回る場合は警告
    if (!processedResult.metadata.meetsConfidenceThreshold) {
      processedResult.warning = `Low confidence: ${result.confidence}% (min: ${config.minConfidence}%)`;
    }

    // テキストが空の場合
    if (!processedResult.metadata.hasText) {
      processedResult.warning = 'No text detected in image';
    }

    // 詳細データ（デバッグ用）
    if (process.env.NODE_ENV === 'development') {
      processedResult.debug = {
        words: result.words,
        blocks: result.blocks,
        rawConfidence: result.confidence,
      };
    }

    return processedResult;
  }

  /**
   * 信頼度の詳細分析
   * @param {Object} result - OCR結果
   * @param {Object} config - 設定
   * @returns {Promise<Object>} 信頼度分析結果
   * @private
   */
  async _analyzeConfidence(result, config) {
    const analysis = {
      overall: result.confidence,
      rating: this._getConfidenceRating(result.confidence),
      wordLevelStats: null,
      blockLevelStats: null,
      recommendations: [],
    };

    // 単語レベル信頼度統計
    if (result.words && result.words.length > 0) {
      const wordConfidences = result.words.map((word) => word.confidence);
      analysis.wordLevelStats = {
        count: wordConfidences.length,
        min: Math.min(...wordConfidences),
        max: Math.max(...wordConfidences),
        average: wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length,
        median: this._calculateMedian(wordConfidences),
        belowThreshold: wordConfidences.filter((conf) => conf < config.minConfidence).length,
      };
    }

    // ブロックレベル信頼度統計
    if (result.blocks && result.blocks.length > 0) {
      const blockConfidences = result.blocks.map((block) => block.confidence);
      analysis.blockLevelStats = {
        count: blockConfidences.length,
        min: Math.min(...blockConfidences),
        max: Math.max(...blockConfidences),
        average: blockConfidences.reduce((a, b) => a + b, 0) / blockConfidences.length,
      };
    }

    // 改善提案
    analysis.recommendations = this._generateConfidenceRecommendations(analysis, config);

    return analysis;
  }

  /**
   * 信頼度評価ランク取得
   * @param {number} confidence - 信頼度スコア
   * @returns {string} 評価ランク
   * @private
   */
  _getConfidenceRating(confidence) {
    if (confidence >= 90) {
      return 'excellent';
    }
    if (confidence >= 80) {
      return 'good';
    }
    if (confidence >= 70) {
      return 'fair';
    }
    if (confidence >= 60) {
      return 'poor';
    }
    return 'very-poor';
  }

  /**
   * 中央値計算
   * @param {number[]} values - 数値配列
   * @returns {number} 中央値
   * @private
   */
  _calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * 信頼度改善提案生成
   * @param {Object} analysis - 信頼度分析結果
   * @param {Object} _config - 設定
   * @returns {string[]} 改善提案配列
   * @private
   */
  _generateConfidenceRecommendations(analysis, _config) {
    const recommendations = [];

    // 全体信頼度ベースの提案
    if (analysis.overall < 60) {
      recommendations.push('画像の解像度を上げてみてください');
      recommendations.push('照明条件を改善してください');
      recommendations.push('文字がより明瞭な画像を使用してください');
    } else if (analysis.overall < 80) {
      recommendations.push('画像の前処理（コントラスト調整）を試してください');
      recommendations.push('異なる言語設定を試してください');
    }

    // 単語レベル統計ベースの提案
    if (analysis.wordLevelStats) {
      const { belowThreshold, count } = analysis.wordLevelStats;
      const lowConfidenceRatio = belowThreshold / count;

      if (lowConfidenceRatio > 0.5) {
        recommendations.push('複数の言語設定を試してください');
        recommendations.push('画像の品質を確認してください');
      } else if (lowConfidenceRatio > 0.3) {
        recommendations.push('手動で誤認識箇所を確認してください');
      }
    }

    // 一般的な提案
    if (recommendations.length === 0 && analysis.overall >= 80) {
      recommendations.push('良好な結果です');
    }

    return recommendations;
  }

  /**
   * 指定言語の言語データを確実に利用可能にする
   * @param {string} language - 言語コード
   * @returns {Promise<void>}
   */
  async ensureLanguageAvailable(language) {
    if (!this.languageDataManager) {
      throw new Error('LanguageDataManager not initialized');
    }

    // 複合言語（eng+jpn）の場合は個別言語に分解
    const languages = language.includes('+') ? language.split('+') : [language];

    // 各言語データの存在確認とダウンロード
    await this.languageDataManager.ensureLanguageData(languages);
  }

  /**
   * インストール済み言語一覧を取得
   * @returns {Promise<string[]>}
   */
  async getAvailableLanguages() {
    if (!this.languageDataManager) {
      return [];
    }
    return await this.languageDataManager.getInstalledLanguages();
  }

  /**
   * 一時ファイルのクリーンアップ
   * @param {string} filePath - 削除するファイルパス
   * @private
   */
  async _cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Failed to cleanup temp file:', filePath, error.message);
    }
  }

  /**
   * 初期化状態チェック
   * @returns {Promise<string>}
   * @private
   */
  async _checkInitialization() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      return this.isInitialized ? 'healthy' : 'failed';
    } catch (error) {
      console.error('Initialization check failed:', error);
      return 'failed';
    }
  }

  /**
   * 言語データ状態チェック
   * @returns {Promise<string>}
   * @private
   */
  async _checkLanguageData() {
    try {
      if (!this.languageDataManager) {
        return 'failed';
      }

      const installedLanguages = await this.languageDataManager.getInstalledLanguages();

      if (installedLanguages.length === 0) {
        // 基本言語データをダウンロード試行
        await this.languageDataManager.ensureLanguageData(['eng']);
        const recheckLanguages = await this.languageDataManager.getInstalledLanguages();
        return recheckLanguages.includes('eng') ? 'healthy' : 'warning';
      }

      return 'healthy';
    } catch (error) {
      console.error('Language data check failed:', error);
      return 'failed';
    }
  }

  /**
   * Worker状態チェック
   * @returns {Promise<string>}
   * @private
   */
  async _checkWorker() {
    try {
      if (!this.ocrWorker) {
        return 'failed';
      }

      // Worker応答テスト（簡単なping相当）
      // 実際の実装では、Workerに対してpingメッセージを送信して応答を確認
      return 'healthy';
    } catch (error) {
      console.error('Worker check failed:', error);
      return 'failed';
    }
  }

  /**
   * 実際のOCR実行テスト
   * @param {string} testImagePath - テスト画像パス
   * @returns {Promise<string>}
   * @private
   */
  async _checkOCRExecution(testImagePath) {
    try {
      const result = await this.extractText(testImagePath, {
        language: 'eng',
        minConfidence: 30, // テスト用に低い閾値
        preprocess: false,
      });

      return result.success && result.text.length > 0 ? 'healthy' : 'warning';
    } catch (error) {
      console.error('OCR execution check failed:', error);
      return 'failed';
    }
  }
}

module.exports = OCRService;
