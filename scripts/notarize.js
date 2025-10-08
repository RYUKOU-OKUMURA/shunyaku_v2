/**
 * Electron Builder Notarization Script
 * 
 * electron-builderのafterSignフックで実行される公証スクリプト
 * ビルドプロセス中に自動で公証を実行する
 * 
 * 作成日: 2025-10-08
 * 対象: Shunyaku v2
 */

const { notarize } = require('electron-notarize');
const path = require('path');

/**
 * 公証実行のメイン関数
 * @param {Object} context - electron-builderのコンテキスト
 * @returns {Promise<void>}
 */
async function notarizeApp(context) {
    const { electronPlatformName, appOutDir } = context;
    
    // macOS以外はスキップ
    if (electronPlatformName !== 'darwin') {
        console.log('🏃‍♂️ スキップ: macOS以外のプラットフォーム');
        return;
    }
    
    console.log('🔒 公証プロセスを開始...');
    
    // 必須環境変数のチェック
    const apiKey = process.env.NOTARIZE_API_KEY;
    const apiIssuer = process.env.NOTARIZE_API_ISSUER;
    const apiKeyPath = process.env.NOTARIZE_API_KEY_FILE;
    
    if (!apiKey || !apiIssuer || !apiKeyPath) {
        console.warn('⚠️  公証がスキップされました: 必要な環境変数が設定されていません');
        console.log('必要な環境変数:');
        console.log('  - NOTARIZE_API_KEY');
        console.log('  - NOTARIZE_API_ISSUER');  
        console.log('  - NOTARIZE_API_KEY_FILE');
        return;
    }
    
    // APIキーファイルの存在確認
    const fs = require('fs');
    if (!fs.existsSync(apiKeyPath)) {
        console.error(`❌ APIキーファイルが見つかりません: ${apiKeyPath}`);
        throw new Error('APIキーファイルが見つかりません');
    }
    
    // アプリケーション情報
    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);
    const bundleId = 'com.shunyaku.v2';
    
    console.log('📋 公証パラメータ:');
    console.log(`  Bundle ID: ${bundleId}`);
    console.log(`  App Path: ${appPath}`);
    console.log(`  API Key: ${apiKey}`);
    console.log(`  Issuer: ${apiIssuer}`);
    console.log(`  Key File: ${apiKeyPath}`);
    
    try {
        // 公証実行
        console.log('🚀 notarize開始...');
        console.time('公証処理時間');
        
        await notarize({
            appBundleId: bundleId,
            appPath: appPath,
            apiKey: apiKey,
            apiIssuer: apiIssuer,
            apiKeyPath: apiKeyPath,
        });
        
        console.timeEnd('公証処理時間');
        console.log('✅ 公証完了!');
        
    } catch (error) {
        console.error('❌ 公証エラー:', error);
        
        // エラー詳細を表示
        if (error.message) {
            console.error('エラーメッセージ:', error.message);
        }
        
        // 公証プロセスのエラーでもビルドを続行するかどうか
        if (process.env.NOTARIZE_IGNORE_ERRORS === 'true') {
            console.warn('⚠️  公証エラーを無視してビルド継続します');
            return;
        }
        
        // 公証エラーでビルドを中断
        throw error;
    }
}

/**
 * afterSignフック関数
 * electron-builderから呼び出される
 */
exports.default = notarizeApp;

// 開発/テスト用の直接実行サポート
if (require.main === module) {
    console.log('🧪 テストモード: 公証スクリプト直接実行');
    
    // テスト用のモックコンテキスト
    const mockContext = {
        electronPlatformName: 'darwin',
        appOutDir: 'dist/mac',
        packager: {
            appInfo: {
                productFilename: 'Shunyaku v2'
            }
        }
    };
    
    notarizeApp(mockContext)
        .then(() => {
            console.log('✅ テスト実行完了');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ テスト実行エラー:', error);
            process.exit(1);
        });
}