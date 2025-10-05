/**
 * CaptureServiceの手動動作テスト
 * 実際のElectron環境でのスクリーンキャプチャをテスト
 */

const { app } = require('electron');
const CaptureService = require('./src/services/CaptureService');

async function testCaptureService() {
  console.log('=== CaptureService Manual Test ===');

  const captureService = new CaptureService();

  try {
    // 1. 利用可能な画面ソースを取得
    console.log('\n1. Getting available screens...');
    const sources = await captureService.getAvailableSources();
    console.log(`Found ${sources.length} screen sources:`);
    sources.forEach((source, index) => {
      console.log(`  ${index + 1}. ${source.name} (ID: ${source.id})`);
    });

    if (sources.length === 0) {
      console.log('No screen sources available. Test cannot continue.');
      return;
    }

    // 2. 最初の画面をキャプチャ
    console.log('\n2. Capturing first screen...');
    const firstScreenPath = await captureService.captureScreen(sources[0].id);
    console.log(`Screenshot saved: ${firstScreenPath}`);

    // 3. 高解像度キャプチャのテスト
    console.log('\n3. Capturing high-resolution screen...');
    const highResPath = await captureService.captureHighResolutionScreen(sources[0].id);
    console.log(`High-res screenshot saved: ${highResPath}`);

    // 4. 全画面キャプチャのテスト（複数画面対応）
    console.log('\n4. Capturing all screens...');
    const allCaptures = await captureService.captureAllScreens();
    console.log(`Captured ${allCaptures.length} screens:`);
    allCaptures.forEach((capture, index) => {
      console.log(`  ${index + 1}. ${capture.sourceName}: ${capture.filePath}`);
    });

    // 5. 一時ファイルの確認
    console.log('\n5. Checking temp files...');
    console.log(`Active temp files: ${captureService.tempFiles.size}`);

    // 6. クリーンアップのテスト
    console.log('\n6. Cleaning up temp files...');
    await captureService.cleanupTempFiles();
    console.log(`Temp files after cleanup: ${captureService.tempFiles.size}`);

    console.log('\n✅ All capture tests completed successfully!');

  } catch (error) {
    console.error('❌ Capture test failed:', error);
  } finally {
    await captureService.shutdown();
    console.log('\n🔄 CaptureService shutdown completed');
  }
}

// Electronアプリとして実行
app.whenReady().then(() => {
  testCaptureService().then(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});