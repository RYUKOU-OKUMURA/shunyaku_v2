/**
 * ImagePreprocessor.js - 画像前処理サービス
 *
 * OCR精度向上のための画像前処理を実行します。
 * リサイズ、コントラスト調整、ノイズ除去など、OCR認識率向上に効果的な処理を提供します。
 *
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

/**
 * 画像前処理クラス
 */
class ImagePreprocessor {
  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'shunyaku-ocr-temp');
    this.supportedFormats = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp'];
  }

  /**
   * 前処理サービスを初期化
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // 一時ディレクトリを作成
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`ImagePreprocessor temp directory: ${this.tempDir}`);
    } catch (error) {
      console.error('Failed to initialize ImagePreprocessor:', error);
      throw error;
    }
  }

  /**
   * OCR用画像前処理（メインメソッド）
   * @param {string} inputPath - 入力画像パス
   * @param {Object} options - 前処理オプション
   * @param {number} options.scaleFactor - 縮小倍率 (デフォルト: 0.5 = 2倍縮小)
   * @param {boolean} options.enhanceContrast - コントラスト強化 (デフォルト: true)
   * @param {boolean} options.sharpen - シャープ化 (デフォルト: true)
   * @param {boolean} options.denoise - ノイズ除去 (デフォルト: false)
   * @param {string} options.outputFormat - 出力フォーマット (デフォルト: 'png')
   * @returns {Promise<string>} 処理済み画像パス
   */
  async preprocessForOCR(inputPath, options = {}) {
    const config = {
      scaleFactor: options.scaleFactor || 0.5, // 2倍縮小
      enhanceContrast: options.enhanceContrast !== false,
      sharpen: options.sharpen !== false,
      denoise: options.denoise || false,
      outputFormat: options.outputFormat || 'png',
    };

    try {
      // 入力ファイル検証
      await this._validateInputFile(inputPath);

      // 一意な出力ファイル名生成
      const outputPath = await this._generateOutputPath(inputPath, config.outputFormat);

      console.log(`Preprocessing image: ${inputPath} -> ${outputPath}`);
      console.log('Preprocessing config:', config);

      // Sharp処理チェーン構築
      let processor = sharp(inputPath);

      // メタデータ取得（処理前のサイズ確認用）
      const metadata = await processor.metadata();
      console.log(`Original image: ${metadata.width}x${metadata.height}, ${metadata.format}`);

      // 1. リサイズ処理（2倍縮小）
      if (config.scaleFactor !== 1.0) {
        const newWidth = Math.round(metadata.width * config.scaleFactor);
        const newHeight = Math.round(metadata.height * config.scaleFactor);

        processor = processor.resize(newWidth, newHeight, {
          kernel: sharp.kernel.lanczos3, // 高品質リサンプリング
          withoutEnlargement: true,
        });

        console.log(`Resizing to: ${newWidth}x${newHeight} (scale: ${config.scaleFactor})`);
      }

      // 2. コントラスト強化
      if (config.enhanceContrast) {
        processor = processor.normalize({
          lower: 1,  // 最暗点を調整
          upper: 99,  // 最明点を調整
        });
        console.log('Applied contrast enhancement');
      }

      // 3. シャープ化（文字認識向上）
      if (config.sharpen) {
        processor = processor.sharpen({
          sigma: 1.0,      // シャープ化の強度
          flat: 1.0,       // フラット領域の閾値
          jagged: 2.0,      // エッジの閾値
        });
        console.log('Applied sharpening');
      }

      // 4. ノイズ除去（オプション）
      if (config.denoise) {
        processor = processor.median(3); // 3x3中央値フィルタ
        console.log('Applied denoising');
      }

      // 5. 出力フォーマット設定
      switch (config.outputFormat.toLowerCase()) {
      case 'png':
        processor = processor.png({
          quality: 100,
          compressionLevel: 0, // 無圧縮（OCR精度優先）
          palette: false,       // フルカラー
        });
        break;
      case 'jpg':
      case 'jpeg':
        processor = processor.jpeg({
          quality: 95,
          progressive: false,
          mozjpeg: true,
        });
        break;
      default:
        processor = processor.png({ quality: 100 });
      }

      // 処理実行
      const startTime = Date.now();
      await processor.toFile(outputPath);
      const processingTime = Date.now() - startTime;

      // 処理結果の確認
      const outputMetadata = await sharp(outputPath).metadata();
      console.log(`Processed image: ${outputMetadata.width}x${outputMetadata.height}, ${outputMetadata.format}`);
      console.log(`Processing completed in ${processingTime}ms`);

      return outputPath;

    } catch (error) {
      console.error('Image preprocessing failed:', error);
      throw new Error(`Image preprocessing failed: ${error.message}`);
    }
  }

  /**
   * 標準的なOCR前処理（2倍縮小 + 基本強化）
   * @param {string} inputPath - 入力画像パス
   * @returns {Promise<string>} 処理済み画像パス
   */
  async preprocessStandard(inputPath) {
    return this.preprocessForOCR(inputPath, {
      scaleFactor: 0.5,
      enhanceContrast: true,
      sharpen: true,
      denoise: false,
    });
  }

  /**
   * 高品質OCR前処理（サイズそのまま + 強い処理）
   * @param {string} inputPath - 入力画像パス
   * @returns {Promise<string>} 処理済み画像パス
   */
  async preprocessHighQuality(inputPath) {
    return this.preprocessForOCR(inputPath, {
      scaleFactor: 1.0,
      enhanceContrast: true,
      sharpen: true,
      denoise: true,
    });
  }

  /**
   * 軽量前処理（リサイズのみ）
   * @param {string} inputPath - 入力画像パス
   * @returns {Promise<string>} 処理済み画像パス
   */
  async preprocessLight(inputPath) {
    return this.preprocessForOCR(inputPath, {
      scaleFactor: 0.5,
      enhanceContrast: false,
      sharpen: false,
      denoise: false,
    });
  }

  /**
   * 一時ファイルをクリーンアップ
   * @param {string} filePath - 削除するファイルパス
   * @returns {Promise<void>}
   */
  async cleanupTempFile(filePath) {
    try {
      // 一時ディレクトリ内のファイルのみ削除
      if (filePath.startsWith(this.tempDir)) {
        await fs.unlink(filePath);
        console.log(`Cleaned up temp file: ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.warn('Failed to cleanup temp file:', error.message);
    }
  }

  /**
   * すべての一時ファイルをクリーンアップ
   * @returns {Promise<void>}
   */
  async cleanupAllTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const cleanupPromises = files.map(file =>
        this.cleanupTempFile(path.join(this.tempDir, file)),
      );
      await Promise.all(cleanupPromises);
      console.log(`Cleaned up ${files.length} temp files`);
    } catch (error) {
      console.warn('Failed to cleanup all temp files:', error.message);
    }
  }

  /**
   * 入力ファイルの検証
   * @param {string} inputPath - 入力ファイルパス
   * @private
   */
  async _validateInputFile(inputPath) {
    try {
      const stats = await fs.stat(inputPath);

      if (!stats.isFile()) {
        throw new Error(`Not a file: ${inputPath}`);
      }

      // ファイルサイズチェック（50MB上限）
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }

      // 拡張子チェック
      const ext = path.extname(inputPath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        throw new Error(`Unsupported format: ${ext}`);
      }

      // 実際に画像として読み込めるかチェック
      const metadata = await sharp(inputPath).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
      }

    } catch (error) {
      throw new Error(`Invalid input file: ${error.message}`);
    }
  }

  /**
   * 出力パスを生成
   * @param {string} inputPath - 入力パス
   * @param {string} format - 出力フォーマット
   * @returns {Promise<string>} 出力パス
   * @private
   */
  async _generateOutputPath(inputPath, format) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const basename = path.basename(inputPath, path.extname(inputPath));
    const filename = `${basename}_processed_${timestamp}_${random}.${format}`;

    return path.join(this.tempDir, filename);
  }
}

module.exports = ImagePreprocessor;
