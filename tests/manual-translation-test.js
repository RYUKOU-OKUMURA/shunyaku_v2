/**
 * manual-translation-test.js
 * 
 * TranslationServiceの手動テスト用スクリプト
 * 実際のDeepL APIキーを使用して翻訳機能をテストします
 * 
 * 使用方法:
 * 1. DeepL APIキーをKeychainに設定
 * 2. node tests/manual-translation-test.js を実行
 * 
 * 注意: このテストは実際のDeepL APIを呼び出すため、APIキーが必要です
 */

const TranslationService = require('../src/services/TranslationService');

async function manualTranslationTest() {
    console.log('=== TranslationService 手動テスト開始 ===\n');
    
    try {
        // TranslationServiceインスタンスを作成
        const translationService = new TranslationService({
            maxRetries: 2,
            initialRetryDelay: 500,
            timeout: 10000
        });

        console.log('1. TranslationService初期化テスト');
        const initResult = await translationService.initialize();
        if (initResult) {
            console.log('✅ 初期化成功');
        } else {
            console.log('❌ 初期化失敗 - APIキーがKeychainに設定されていない可能性があります');
            return;
        }

        console.log('\n2. ヘルスチェックテスト');
        const healthResult = await translationService.healthCheck();
        console.log(`健全性: ${healthResult.status}`);
        console.log(`チェック結果:`, healthResult.checks);
        if (healthResult.errors.length > 0) {
            console.log(`エラー: ${healthResult.errors.join(', ')}`);
        }

        if (healthResult.status !== 'healthy') {
            console.log('❌ ヘルスチェック失敗');
            return;
        }
        console.log('✅ ヘルスチェック成功');

        console.log('\n3. 使用量情報取得テスト');
        const usage = await translationService.getUsage();
        console.log(`文字使用量: ${usage.character.count}/${usage.character.limit}`);
        console.log('✅ 使用量情報取得成功');

        console.log('\n4. サポート言語取得テスト');
        const languages = await translationService.getSupportedLanguages();
        console.log(`ソース言語数: ${languages.source.length}`);
        console.log(`ターゲット言語数: ${languages.target.length}`);
        console.log('✅ サポート言語取得成功');

        console.log('\n5. 翻訳テスト（英語→日本語）');
        const testText = 'Hello, this is a test for the translation service.';
        console.log(`元テキスト: "${testText}"`);
        
        const translationResult = await translationService.translate(testText, 'ja', 'en');
        console.log(`翻訳結果: "${translationResult.translatedText}"`);
        console.log(`検出された元言語: ${translationResult.sourceLanguage}`);
        console.log(`処理時間: ${translationResult.duration}ms`);
        console.log(`使用文字数: ${translationResult.usage.charactersCount}`);
        console.log('✅ 英語→日本語翻訳成功');

        console.log('\n6. 翻訳テスト（日本語→英語）');
        const testTextJa = 'こんにちは、これは翻訳サービスのテストです。';
        console.log(`元テキスト: "${testTextJa}"`);
        
        const translationResultJa = await translationService.translate(testTextJa, 'en', 'ja');
        console.log(`翻訳結果: "${translationResultJa.translatedText}"`);
        console.log(`検出された元言語: ${translationResultJa.sourceLanguage}`);
        console.log(`処理時間: ${translationResultJa.duration}ms`);
        console.log(`使用文字数: ${translationResultJa.usage.charactersCount}`);
        console.log('✅ 日本語→英語翻訳成功');

        console.log('\n7. 自動言語検出テスト');
        const autoDetectResult = await translationService.translate('Bonjour le monde', 'en', null);
        console.log(`元テキスト: "Bonjour le monde"`);
        console.log(`翻訳結果: "${autoDetectResult.translatedText}"`);
        console.log(`検出された元言語: ${autoDetectResult.sourceLanguage}`);
        console.log('✅ 自動言語検出翻訳成功');

        console.log('\n8. 統計情報確認');
        console.log('使用統計:', translationService.usageStats);

        console.log('\n=== 全テスト成功！ ===');
        console.log('DeepL APIとの連携が正常に動作しています。');

    } catch (error) {
        console.error('❌ テスト失敗:', error.message);
        console.error('詳細:', error);
    }
}

// テストスクリプトとして実行された場合
if (require.main === module) {
    manualTranslationTest().catch(console.error);
}

module.exports = manualTranslationTest;