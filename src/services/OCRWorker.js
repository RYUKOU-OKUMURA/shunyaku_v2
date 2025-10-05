/**
 * OCRWorker.js - Tesseract.js OCR処理をWorker Threadsで実行
 *
 * Worker Threadsを使用してOCR処理をメインスレッドから分離し、
 * アプリのレスポンシブ性を維持します。
 *
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const { Worker, isMainThread, parentPort } = require('worker_threads');
const { createWorker } = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

if (isMainThread) {
  /**
   * メインスレッド: OCRWorkerクラス定義
   */
  class OCRWorker {
    constructor() {
      this.worker = null;
      this.isInitialized = false;
    }

    /**
     * OCR Workerを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
      if (this.isInitialized) {
        return;
      }

      return new Promise((resolve, reject) => {
        // Worker Threadを起動
        this.worker = new Worker(__filename, {
          workerData: {
            command: 'initialize',
            tessdataPath: this._getTessdataPath(),
          },
        });

        this.worker.on('message', (message) => {
          if (message.type === 'initialized') {
            this.isInitialized = true;
            resolve();
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        });

        this.worker.on('error', (error) => {
          reject(error);
        });

        // 5秒でタイムアウト
        setTimeout(() => {
          if (!this.isInitialized) {
            reject(new Error('OCR Worker initialization timeout'));
          }
        }, 5000);
      });
    }

    /**
     * OCR実行
     * @param {string} imagePath - 画像ファイルパス
     * @param {string} language - 言語コード ('eng', 'jpn', 'eng+jpn')
     * @param {Object} options - オプション設定
     * @returns {Promise<Object>} OCR結果
     */
    async recognize(imagePath, language = 'eng+jpn', options = {}) {
      if (!this.isInitialized) {
        await this.initialize();
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('OCR recognition timeout'));
        }, 30000); // 30秒タイムアウト

        this.worker.postMessage({
          command: 'recognize',
          imagePath,
          language,
          options,
        });

        this.worker.on('message', (message) => {
          clearTimeout(timeout);

          if (message.type === 'recognition-complete') {
            resolve(message.result);
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        });
      });
    }

    /**
     * Worker終了
     */
    async terminate() {
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
        this.isInitialized = false;
      }
    }

    /**
     * tessdataディレクトリパスを取得
     * @returns {string}
     */
    _getTessdataPath() {
      const appDataPath = app.getPath('userData');
      return path.join(appDataPath, 'tessdata');
    }
  }

  module.exports = OCRWorker;
} else {
  /**
   * Worker Thread: OCR処理の実装
   */
  let tesseractWorker = null;

  /**
   * Worker Thread内でのメッセージ処理
   */
  parentPort.on('message', async (message) => {
    try {
      switch (message.command) {
        case 'initialize':
          await initializeTesseract(message.tessdataPath);
          parentPort.postMessage({ type: 'initialized' });
          break;

        case 'recognize': {
          const result = await performOCR(message.imagePath, message.language, message.options);
          parentPort.postMessage({
            type: 'recognition-complete',
            result,
          });
          break;
        }

        default:
          throw new Error(`Unknown command: ${message.command}`);
      }
    } catch (error) {
      parentPort.postMessage({
        type: 'error',
        error: error.message,
      });
    }
  });

  /**
   * Tesseract.jsワーカーを初期化
   * @param {string} tessdataPath - tessdataディレクトリパス
   */
  const initializeTesseract = async function (tessdataPath) {
    if (tesseractWorker) {
      return;
    }

    // tessdataディレクトリの存在確認
    try {
      await fs.access(tessdataPath);
    } catch (error) {
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(tessdataPath, { recursive: true });
    }

    // Tesseractワーカーを作成
    tesseractWorker = await createWorker();

    // 言語データのパスを設定
    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: '6', // Uniform block of text
      preserve_interword_spaces: '1',
    });
  };

  /**
   * OCR実行
   * @param {string} imagePath - 画像ファイルパス
   * @param {string} language - 言語コード
   * @param {Object} options - オプション
   * @returns {Promise<Object>} OCR結果
   */
  const performOCR = async function (imagePath, language, options = {}) {
    if (!tesseractWorker) {
      throw new Error('Tesseract worker not initialized');
    }

    // 画像ファイルの存在確認
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // 言語設定
    await tesseractWorker.loadLanguage(language);
    await tesseractWorker.initialize(language);

    // OCR実行
    const { data } = await tesseractWorker.recognize(imagePath);

    // 結果を整理
    const result = {
      text: data.text.trim(),
      confidence: data.confidence,
      words: data.words.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1,
        },
      })),
      blocks: data.blocks.map((block) => ({
        text: block.text,
        confidence: block.confidence,
        bbox: {
          x0: block.bbox.x0,
          y0: block.bbox.y0,
          x1: block.bbox.x1,
          y1: block.bbox.y1,
        },
      })),
      language: language,
      processingTime: Date.now() - (options.startTime || Date.now()),
    };

    return result;
  };

  /**
   * Worker Thread終了時のクリーンアップ
   */
  process.on('exit', async () => {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
    }
  });
}
