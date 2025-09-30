const { app, BrowserWindow } = require('electron');
const path = require('path');

/**
 * Shunyaku v2 - Main Process Entry Point
 * Local Hover Translation App for macOS
 *
 * このファイルはElectronアプリケーションのメインプロセスのエントリーポイントです。
 * アプリの起動、終了、macOS固有の動作を管理します。
 */

let mainWindow = null;

/**
 * メインアプリケーションウィンドウを作成
 * 現在は基本的なウィンドウを表示し、後のフェーズでHUDウィンドウに変更される
 *
 * @returns {void}
 */
function createMainWindow() {
  // メインウィンドウを作成（Phase 1では基本的なテスト用ウィンドウ）
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js'),
    },
  });

  // アプリのHTMLファイルをロード
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 開発時はDevToolsを開く
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // ウィンドウが閉じられたときのイベントハンドラー
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * アプリケーションの初期化とウィンドウ作成
 */
app.whenReady().then(() => {
  // macOS専用アプリとしてのDock動作設定
  if (process.platform === 'darwin') {
    // Dockにアイコンを表示（通常の動作）
    // 後のフェーズでバックグラウンド動作が必要になった場合は app.dock.hide() を使用
    app.dock.show();
  }

  createMainWindow();
});

/**
 * すべてのウィンドウが閉じられたときの処理
 * macOSでは通常、ウィンドウが閉じられてもアプリは終了しない
 */
app.on('window-all-closed', () => {
  // macOS以外ではアプリを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // macOSでは何もしない（Dockに残る）
});

/**
 * アプリがアクティブになったときの処理（macOS）
 * Dockアイコンがクリックされたときなど
 */
app.on('activate', () => {
  // ウィンドウが存在しない場合は新しいウィンドウを作成
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow === null) {
    createMainWindow();
  }
});

/**
 * アプリが終了する前の処理
 */
app.on('before-quit', (_event) => {
  // 必要に応じて設定の保存やクリーンアップ処理を実行
  // 現在は基本実装なので何もしない
});

/**
 * セキュリティ: 新しいウィンドウの作成を制御
 */
app.on('web-contents-created', (event, contents) => {
  // 外部URLの読み込みを防止
  contents.on('will-navigate', (navigationEvent, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // ローカルファイル以外への遷移を防止
    if (parsedUrl.origin !== 'file://') {
      navigationEvent.preventDefault();
    }
  });
});

// アプリの不正な終了を防止
process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception:', error);
  // 本番環境では適切なエラーレポーティングを実装
});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 本番環境では適切なエラーレポーティングを実装
});
