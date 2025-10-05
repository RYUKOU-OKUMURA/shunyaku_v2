/**
 * CaptureService.js
 * スクリーンキャプチャ機能を提供するサービス
 *
 * 機能:
 * - desktopCapturerを使用した画面キャプチャ
 * - マルチディスプレイ対応
 * - 画像の一時保存と削除管理
 * - 範囲選択UI（将来実装）
 */

const { desktopCapturer } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * スクリーンキャプチャサービスクラス
 */
class CaptureService {
  constructor() {
    this.tempDir = path.join(os.homedir(), 'Library', 'Caches', 'Shunyaku');
    this.tempFiles = new Set(); // 一時ファイルの追跡用
  }

  /**
   * 一時ディレクトリを初期化
   * @returns {Promise<void>}
   */
  async initializeTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
      throw new Error('一時ディレクトリの作成に失敗しました');
    }
  }

  /**
   * 利用可能な画面ソースを取得
   * @returns {Promise<Array>} デスクトップソースの配列
   */
  async getAvailableSources() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 200, height: 150 },
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
    } catch (error) {
      console.error('Failed to get desktop sources:', error);
      throw new Error('画面ソースの取得に失敗しました');
    }
  }

  /**
   * 画面全体のスクリーンショットを取得
   * @param {string} sourceId - キャプチャするスクリーンのID（オプション）
   * @returns {Promise<string>} 保存された画像ファイルのパス
   */
  async captureScreen(sourceId = null) {
    try {
      await this.initializeTempDirectory();

      // ソースIDが指定されていない場合は最初の画面を使用
      if (!sourceId) {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        if (sources.length === 0) {
          throw new Error('利用可能な画面が見つかりません');
        }
        sourceId = sources[0].id;
      }

      // スクリーンショットを取得
      const source = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      const targetSource = source.find((s) => s.id === sourceId);
      if (!targetSource) {
        throw new Error('指定された画面が見つかりません');
      }

      // 画像データを取得
      const imageBuffer = targetSource.thumbnail.toPNG();

      // 一時ファイルに保存
      const filename = `screenshot_${Date.now()}.png`;
      const filePath = path.join(this.tempDir, filename);

      await fs.writeFile(filePath, imageBuffer);
      this.tempFiles.add(filePath);

      console.log(`Screenshot captured: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw new Error(`スクリーンショットの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 高解像度スクリーンショットを取得
   * @param {string} sourceId - キャプチャするスクリーンのID
   * @returns {Promise<string>} 保存された画像ファイルのパス
   */
  async captureHighResolutionScreen(sourceId) {
    try {
      await this.initializeTempDirectory();

      // 高解像度でスクリーンショットを取得
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 3840, height: 2160 }, // 4K解像度
      });

      const targetSource = sources.find((s) => s.id === sourceId);
      if (!targetSource) {
        throw new Error('指定された画面が見つかりません');
      }

      const imageBuffer = targetSource.thumbnail.toPNG();

      const filename = `screenshot_hires_${Date.now()}.png`;
      const filePath = path.join(this.tempDir, filename);

      await fs.writeFile(filePath, imageBuffer);
      this.tempFiles.add(filePath);

      console.log(`High-resolution screenshot captured: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Failed to capture high-resolution screen:', error);
      throw new Error(`高解像度スクリーンショットの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * マルチディスプレイ対応：すべての画面をキャプチャ
   * @returns {Promise<Array<object>>} キャプチャされた画像の配列
   */
  async captureAllScreens() {
    try {
      const sources = await this.getAvailableSources();
      const captures = [];

      for (const source of sources) {
        try {
          const filePath = await this.captureScreen(source.id);
          captures.push({
            sourceId: source.id,
            sourceName: source.name,
            filePath: filePath,
          });
        } catch (error) {
          console.warn(`Failed to capture screen ${source.name}:`, error);
        }
      }

      return captures;
    } catch (error) {
      console.error('Failed to capture all screens:', error);
      throw new Error('全画面のキャプチャに失敗しました');
    }
  }

  /**
   * 指定された一時ファイルを削除
   * @param {string} filePath - 削除するファイルのパス
   * @returns {Promise<void>}
   */
  async deleteTempFile(filePath) {
    try {
      if (this.tempFiles.has(filePath)) {
        await fs.unlink(filePath);
        this.tempFiles.delete(filePath);
        console.log(`Temp file deleted: ${filePath}`);
      }
    } catch (error) {
      console.warn(`Failed to delete temp file ${filePath}:`, error);
    }
  }

  /**
   * すべての一時ファイルを削除
   * @returns {Promise<void>}
   */
  async cleanupTempFiles() {
    const deletePromises = Array.from(this.tempFiles).map((filePath) =>
      this.deleteTempFile(filePath)
    );

    await Promise.allSettled(deletePromises);
    this.tempFiles.clear();
    console.log('All temp files cleaned up');
  }

  /**
   * 範囲選択キャプチャ（将来実装）
   * @param {object} bounds - 選択範囲 {x, y, width, height}
   * @returns {Promise<string>} キャプチャされた画像のファイルパス
   */
  async captureRegion(_bounds) {
    // TODO: 範囲選択UIの実装が必要
    throw new Error('範囲選択キャプチャは未実装です');
  }

  /**
   * サービスの終了処理
   * @returns {Promise<void>}
   */
  async shutdown() {
    await this.cleanupTempFiles();
    console.log('CaptureService shutdown completed');
  }
}

module.exports = CaptureService;
