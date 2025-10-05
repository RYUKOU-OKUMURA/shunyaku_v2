/**
 * manual-ocr-integration.js - OCR統合テスト（手動実行用）
 * 
 * 実際のOCR処理を手動でテストするためのスクリプト
 * 実際の画像ファイルを使用してOCR精度を確認します。
 * 
 * Usage: node tests/manual-ocr-integration.js
 * 
 * @author Shunyaku Development Team
 * @since 2024-10-05
 */

const OCRService = require('../src/services/OCRService');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// モックされたElectron app（手動テスト用）
const mockApp = {
  getPath: (pathName) => {
    const testDir = path.join(__dirname, '..', '.test-data');
    switch (pathName) {
      case 'userData':
        return path.join(testDir, 'userdata');
      case 'temp':
        return path.join(testDir, 'temp');
      default:
        return testDir;
    }
  }
};

// Electronのモック
jest.mock('electron', () => ({ app: mockApp }), { virtual: true });

/**
 * テスト用画像を生成
 */
async function createTestImage() {
  const testDir = path.join(__dirname, '..', '.test-data');
  await fs.mkdir(testDir, { recursive: true });
  
  const imagePath = path.join(testDir, 'test-text.png');
  
  // Sharp を使用してテキストを含む画像を生成
  const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="20" y="50" font-family="Arial" font-size="24" fill="black">
        Hello World
      </text>
      <text x="20" y="90" font-family="Arial" font-size="20" fill="black">
        This is a test text for OCR.
      </text>
      <text x="20" y="130" font-family="Arial" font-size="18" fill="black">
        OCR精度テスト用テキスト
      </text>
    </svg>
  `;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(imagePath);
    
  console.log(`Test image created: ${imagePath}`);
  return imagePath;
}

/**
 * OCR統合テスト実行
 */
async function runOCRIntegrationTest() {
  let ocrService = null;
  
  try {
    console.log('=== OCR統合テスト開始 ===\n');
    
    // 1. テスト画像作成
    console.log('1. テスト画像生成中...');
    const testImagePath = await createTestImage();
    
    // 2. OCRService初期化
    console.log('2. OCRService初期化中...');
    ocrService = new OCRService();
    
    console.log('  - 言語データダウンロード中（初回のみ）...');
    console.log('  - 画像処理エンジン準備中...');
    console.log('  - OCRワーカー起動中...');
    
    // 初期化には時間がかかる場合があります
    await ocrService.initialize();
    console.log('  ✅ 初期化完了\n');
    
    // 3. ヘルスチェック実行
    console.log('3. ヘルスチェック実行中...');
    const healthStatus = await ocrService.performHealthCheck();
    console.log(`  - 総合状態: ${healthStatus.overall}`);
    console.log(`  - 初期化: ${healthStatus.components.initialization}`);
    console.log(`  - 言語データ: ${healthStatus.components.languageData}`);
    console.log(`  - ワーカー: ${healthStatus.components.worker}`);
    console.log('  ✅ ヘルスチェック完了\n');
    
    // 4. OCR実行（英語）
    console.log('4. OCR実行テスト（英語）...');
    const englishResult = await ocrService.performOCR(testImagePath, {
      language: 'eng',
      preprocess: true,
      minConfidence: 60
    });
    
    console.log(`  - 実行時間: ${englishResult.totalTime}ms`);
    console.log(`  - 信頼度: ${englishResult.confidence}%`);
    console.log(`  - 抽出テキスト: "${englishResult.text}"`);
    console.log(`  - 単語数: ${englishResult.wordCount}`);
    console.log('  ✅ 英語OCR完了\n');
    
    // 5. OCR実行（日本語）
    console.log('5. OCR実行テスト（日本語）...');
    const japaneseResult = await ocrService.performOCR(testImagePath, {
      language: 'jpn',
      preprocess: true,
      minConfidence: 60
    });
    
    console.log(`  - 実行時間: ${japaneseResult.totalTime}ms`);
    console.log(`  - 信頼度: ${japaneseResult.confidence}%`);
    console.log(`  - 抽出テキスト: "${japaneseResult.text}"`);
    console.log(`  - 単語数: ${japaneseResult.wordCount}`);
    console.log('  ✅ 日本語OCR完了\n');
    
    // 6. 複合言語OCR実行
    console.log('6. OCR実行テスト（英語+日本語）...');
    const combinedResult = await ocrService.performOCR(testImagePath, {
      language: 'eng+jpn',
      preprocess: true,
      minConfidence: 60
    });
    
    console.log(`  - 実行時間: ${combinedResult.totalTime}ms`);
    console.log(`  - 信頼度: ${combinedResult.confidence}%`);
    console.log(`  - 抽出テキスト: "${combinedResult.text}"`);
    console.log(`  - 単語数: ${combinedResult.wordCount}`);
    console.log('  ✅ 複合言語OCR完了\n');
    
    // 7. 結果評価
    console.log('7. 結果評価...');
    const results = [englishResult, japaneseResult, combinedResult];
    const validResults = results.filter(r => r.success && r.confidence >= 60);
    const averageConfidence = validResults.length > 0 
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length 
      : 0;
    
    console.log(`  - 成功した実行: ${validResults.length}/3`);
    console.log(`  - 平均信頼度: ${averageConfidence.toFixed(1)}%`);
    
    // 検証条件チェック
    const meetsRequirements = averageConfidence >= 80;
    console.log(`  - 検証条件（80%以上）: ${meetsRequirements ? '✅ 満たす' : '❌ 満たさない'}`);
    
    if (meetsRequirements) {
      console.log('\n🎉 OCRエンジン実装完了！検証条件を満たしました。');
    } else {
      console.log(`\n⚠️  OCRエンジン基本実装完了。信頼度改善が必要です（現在: ${averageConfidence.toFixed(1)}%, 目標: 80%+）`);
    }
    
    return {
      success: true,
      averageConfidence,
      meetsRequirements,
      results
    };
    
  } catch (error) {
    console.error('\n❌ OCR統合テストに失敗しました:');
    console.error(error.message);
    console.error('\nスタックトレース:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
    
  } finally {
    // クリーンアップ
    if (ocrService) {
      console.log('\n8. クリーンアップ中...');
      await ocrService.shutdown();
      console.log('  ✅ クリーンアップ完了');
    }
    
    console.log('\n=== OCR統合テスト終了 ===');
  }
}

// 手動実行用
if (require.main === module) {
  runOCRIntegrationTest()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runOCRIntegrationTest };