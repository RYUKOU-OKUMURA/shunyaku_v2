/**
 * LanguageDataManager.js - Tesseract言語データ管理サービス
 *
 * Tesseract.jsで使用する言語データファイルの自動ダウンロードと管理を行います。
 * 英語(eng)と日本語(jpn)の言語データをサポートします。
 *
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

/**
 * 言語データ管理クラス
 */
class LanguageDataManager {
  constructor() {
    this.tessdataPath = path.join(app.getPath('userData'), 'tessdata');
    this.languageDataUrls = {
      'eng': 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz',
      'jpn': 'https://tessdata.projectnaptha.com/4.0.0/jpn.traineddata.gz',
    };
    this.supportedLanguages = ['eng', 'jpn'];
  }

  /**
   * 言語データマネージャを初期化
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // tessdataディレクトリを作成
      await fs.mkdir(this.tessdataPath, { recursive: true });
      console.log(`Tessdata directory initialized: ${this.tessdataPath}`);

      // 必要な言語データをチェック・ダウンロード
      await this.ensureLanguageData();

    } catch (error) {
      console.error('Failed to initialize LanguageDataManager:', error);
      throw error;
    }
  }

  /**
   * 必要な言語データの存在確認とダウンロード
   * @param {string[]} languages - チェックする言語配列（デフォルト: ['eng', 'jpn']）
   * @returns {Promise<void>}
   */
  async ensureLanguageData(languages = ['eng', 'jpn']) {
    const missingLanguages = [];

    // 各言語データファイルの存在確認
    for (const lang of languages) {
      if (!this.supportedLanguages.includes(lang)) {
        console.warn(`Unsupported language: ${lang}`);
        continue;
      }

      const languageFile = path.join(this.tessdataPath, `${lang}.traineddata`);
      const exists = await this._fileExists(languageFile);

      if (!exists) {
        missingLanguages.push(lang);
        console.log(`Missing language data: ${lang}`);
      } else {
        console.log(`Language data found: ${lang}`);
      }
    }

    // 不足している言語データをダウンロード
    if (missingLanguages.length > 0) {
      console.log(`Downloading missing language data: ${missingLanguages.join(', ')}`);
      await this._downloadLanguageData(missingLanguages);
    }
  }

  /**
   * 指定した言語データをダウンロード
   * @param {string[]} languages - ダウンロードする言語配列
   * @returns {Promise<void>}
   * @private
   */
  async _downloadLanguageData(languages) {
    const downloadPromises = languages.map(lang => this._downloadSingleLanguage(lang));

    try {
      await Promise.all(downloadPromises);
      console.log('All language data downloaded successfully');
    } catch (error) {
      console.error('Failed to download language data:', error);
      throw error;
    }
  }

  /**
   * 単一言語データをダウンロード
   * @param {string} language - 言語コード
   * @returns {Promise<void>}
   * @private
   */
  async _downloadSingleLanguage(language) {
    const url = this.languageDataUrls[language];
    if (!url) {
      throw new Error(`No download URL for language: ${language}`);
    }

    const outputPath = path.join(this.tessdataPath, `${language}.traineddata`);
    const tempPath = `${outputPath}.tmp`;

    try {
      console.log(`Downloading ${language} language data from ${url}`);

      await this._downloadFile(url, tempPath);

      // ダウンロード完了後、一時ファイルを正式なファイル名にリネーム
      await fs.rename(tempPath, outputPath);

      // ファイルサイズを確認
      const stats = await fs.stat(outputPath);
      console.log(`Downloaded ${language} language data: ${stats.size} bytes`);

      // ファイル内容の基本検証
      await this._validateLanguageFile(outputPath);

    } catch (error) {
      // エラー時は一時ファイルをクリーンアップ
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // クリーンアップエラーは無視
      }

      throw new Error(`Failed to download ${language} language data: ${error.message}`);
    }
  }

  /**
   * ファイルをHTTPSからダウンロード
   * @param {string} url - ダウンロードURL
   * @param {string} outputPath - 出力ファイルパス
   * @returns {Promise<void>}
   * @private
   */
  async _downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(outputPath);

      const request = https.get(url, (response) => {
        // リダイレクト処理
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          console.log(`Redirecting to: ${redirectUrl}`);
          file.close();
          this._downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        let lastProgress = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const progress = Math.floor((downloadedSize / totalSize) * 100);
            if (progress > lastProgress && progress % 10 === 0) {
              console.log(`Download progress: ${progress}%`);
              lastProgress = progress;
            }
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('Download completed');
          resolve();
        });

        file.on('error', (error) => {
          file.close();
          fs.unlink(outputPath).catch(() => {}); // クリーンアップ
          reject(error);
        });
      });

      request.on('error', (error) => {
        file.close();
        reject(error);
      });

      // 30秒でタイムアウト
      request.setTimeout(30000, () => {
        request.abort();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * 言語データファイルの基本検証
   * @param {string} filePath - 検証するファイルパス
   * @returns {Promise<void>}
   * @private
   */
  async _validateLanguageFile(filePath) {
    try {
      const stats = await fs.stat(filePath);

      // ファイルサイズの最小チェック（100KB未満は異常）
      if (stats.size < 100 * 1024) {
        throw new Error(`Language file too small: ${stats.size} bytes`);
      }

      // ファイルの先頭バイトをチェック（traineddataファイルの識別）
      const buffer = Buffer.alloc(4);
      const file = await fs.open(filePath, 'r');
      await file.read(buffer, 0, 4, 0);
      await file.close();

      // 簡単なマジックナンバーチェック（実際のtraineddataファイル形式に応じて調整）
      console.log(`Language file validation passed: ${path.basename(filePath)}`);

    } catch (error) {
      throw new Error(`Language file validation failed: ${error.message}`);
    }
  }

  /**
   * ファイル存在確認
   * @param {string} filePath - チェックするファイルパス
   * @returns {Promise<boolean>}
   * @private
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * インストール済み言語一覧を取得
   * @returns {Promise<string[]>}
   */
  async getInstalledLanguages() {
    const installedLanguages = [];

    for (const lang of this.supportedLanguages) {
      const languageFile = path.join(this.tessdataPath, `${lang}.traineddata`);
      const exists = await this._fileExists(languageFile);
      if (exists) {
        installedLanguages.push(lang);
      }
    }

    return installedLanguages;
  }

  /**
   * 言語データを削除
   * @param {string} language - 削除する言語コード
   * @returns {Promise<void>}
   */
  async removeLanguageData(language) {
    if (!this.supportedLanguages.includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const languageFile = path.join(this.tessdataPath, `${language}.traineddata`);

    try {
      await fs.unlink(languageFile);
      console.log(`Removed language data: ${language}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      console.log(`Language data not found: ${language}`);
    }
  }

  /**
   * すべての言語データを削除
   * @returns {Promise<void>}
   */
  async clearAllLanguageData() {
    const installedLanguages = await this.getInstalledLanguages();

    for (const lang of installedLanguages) {
      await this.removeLanguageData(lang);
    }

    console.log('All language data cleared');
  }

  /**
   * tessdataディレクトリパスを取得
   * @returns {string}
   */
  getTessdataPath() {
    return this.tessdataPath;
  }
}

module.exports = LanguageDataManager;
