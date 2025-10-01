const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const HUDWindowManager = require('./HUDWindowManager');

// Services
const SettingsStore = require('../services/SettingsStore');
const KeychainManager = require('../services/KeychainManager');
const TranslationService = require('../services/TranslationService');

/**
 * Shunyaku v2 - Main Process Entry Point
 * Local Hover Translation App for macOS
 *
 * このファイルはElectronアプリケーションのメインプロセスのエントリーポイントです。
 * アプリの起動、終了、macOS固有の動作を管理します。
 */

let mainWindow = null;
let settingsWindow = null;
let hudWindowManager = null;
let settingsStore = null;
let keychainManager = null;
let translationService = null;

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
app.whenReady().then(async () => {
  // macOS専用アプリとしてのDock動作設定
  if (process.platform === 'darwin') {
    // Dockにアイコンを表示（通常の動作）
    // 後のフェーズでバックグラウンド動作が必要になった場合は app.dock.hide() を使用
    app.dock.show();
  }

  // サービスの初期化
  settingsStore = new SettingsStore();
  keychainManager = new KeychainManager();
  translationService = new TranslationService();

  // HUDウィンドウマネージャーを初期化
  hudWindowManager = new HUDWindowManager();

  // メニューバーの設定（macOS用）
  setupApplicationMenu();

  // IPC通信の設定
  setupIPCHandlers();

  createMainWindow();

  // テスト用：3秒後にHUDウィンドウをマウス位置近傍に表示（タスク1.3検証）
  setTimeout(async () => {
    try {
      const { screen } = require('electron');
      const mousePosition = screen.getCursorScreenPoint();
      await hudWindowManager.showHUDNearMouse(mousePosition);
      // eslint-disable-next-line no-console
      console.log(`HUD window displayed near mouse at (${mousePosition.x}, ${mousePosition.y})`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to show HUD window:', error);
    }
  }, 3000);
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
 * 設定ウィンドウを作成
 */
function createSettingsWindow() {
  // 既に設定ウィンドウが開いている場合はフォーカスを当てる
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 700,
    height: 800,
    minWidth: 600,
    minHeight: 700,
    show: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    title: 'Shunyaku v2 - Settings',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/settings-preload.js'),
      webSecurity: true,
    },
  });

  // 設定画面のHTMLをロード
  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  // ウィンドウの準備ができたら表示
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();

    // 開発時はDevToolsを開く
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      settingsWindow.webContents.openDevTools();
    }
  });

  // ウィンドウが閉じられたときのクリーンアップ
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

/**
 * アプリケーションメニューの設定（macOS用）
 */
function setupApplicationMenu() {
  if (process.platform === 'darwin') {
    const template = [
      {
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              createSettingsWindow();
            },
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'close' }],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

/**
 * IPC通信ハンドラーの設定
 */
function setupIPCHandlers() {
  // HUDウィンドウを閉じる
  ipcMain.handle('close-hud', () => {
    if (hudWindowManager) {
      hudWindowManager.closeHUD();
    }
  });

  // HUDウィンドウを非表示にする
  ipcMain.handle('hide-hud', () => {
    if (hudWindowManager) {
      hudWindowManager.hideHUD();
    }
  });

  // HUDウィンドウを表示する
  ipcMain.handle('show-hud', async (event, options) => {
    if (hudWindowManager) {
      await hudWindowManager.showHUD(options);
    }
  });

  // HUDウィンドウをマウス位置近傍に表示する（タスク1.3.4）
  ipcMain.handle('show-hud-near-mouse', async () => {
    if (hudWindowManager) {
      const { screen } = require('electron');
      const mousePosition = screen.getCursorScreenPoint();
      await hudWindowManager.showHUDNearMouse(mousePosition);
    }
  });

  // 現在のマウス位置を取得（タスク1.3.4補助）
  ipcMain.handle('get-cursor-position', () => {
    const { screen } = require('electron');
    return screen.getCursorScreenPoint();
  });

  // 設定ウィンドウ関連のIPC
  ipcMain.handle('open-settings', () => {
    createSettingsWindow();
  });

  ipcMain.handle('close-settings-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  });

  ipcMain.handle('minimize-settings-window', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.minimize();
    }
  });

  // 設定管理のIPC
  ipcMain.handle('get-settings', async () => {
    try {
      return settingsStore.getAllSettings();
    } catch (error) {
      console.error('Failed to get settings:', error);
      throw error;
    }
  });

  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      // 各設定カテゴリを個別に保存
      if (settings.translation) {
        settingsStore.setTranslationSettings(settings.translation);
      }
      if (settings.hud) {
        settingsStore.setHUDSettings(settings.hud);
      }
      if (settings.shortcuts) {
        settingsStore.setShortcutSettings(settings.shortcuts);
      }
      if (settings.app) {
        settingsStore.setAppSettings(settings.app);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  });

  ipcMain.handle('reset-settings', async () => {
    try {
      // 設定をデフォルト値にリセット
      settingsStore.resetToDefaults();
      return { success: true };
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  });

  // APIキー管理のIPC
  ipcMain.handle('has-api-key', async (event, keyName) => {
    try {
      return await keychainManager.hasAPIKey(keyName);
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  });

  ipcMain.handle('save-api-key', async (event, keyName, keyValue) => {
    try {
      if (keyName === 'deepl') {
        await keychainManager.saveDeepLAPIKey(keyValue);
      } else {
        await keychainManager.saveAPIKey(keyName, keyValue);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-api-key', async (event, keyName) => {
    try {
      if (keyName === 'deepl') {
        await keychainManager.deleteDeepLAPIKey();
      } else {
        await keychainManager.deleteAPIKey(keyName);
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to delete API key:', error);
      throw error;
    }
  });

  ipcMain.handle('test-api-key', async (event, keyValue) => {
    try {
      // テンポラリでTranslationServiceを初期化してAPIキーをテスト
      const testService = new TranslationService();
      const result = await testService.testConnection(keyValue);
      return result;
    } catch (error) {
      console.error('Failed to test API key:', error);
      return { success: false, error: error.message };
    }
  });

  // アプリ情報のIPC
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 対応言語の取得
  ipcMain.handle('get-supported-languages', () => {
    return {
      source: [
        { code: 'auto', name: 'Auto Detect' },
        { code: 'en', name: 'English' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh', name: 'Chinese' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
      ],
      target: [
        { code: 'ja', name: 'Japanese' },
        { code: 'en', name: 'English' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh', name: 'Chinese' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
      ],
    };
  });

  // テスト翻訳
  ipcMain.handle('test-translation', async (event, text, targetLang) => {
    try {
      const result = await translationService.translate(text, 'auto', targetLang);
      return result;
    } catch (error) {
      console.error('Failed to test translation:', error);
      throw error;
    }
  });

  // 手動テキスト翻訳（タスク2.5.3）
  ipcMain.handle(
    'translate-text',
    async (event, { text, targetLanguage, sourceLanguage = null }) => {
      try {
        // TranslationServiceが初期化されているかチェック
        if (!translationService.isInitialized()) {
          const initSuccess = await translationService.initialize();
          if (!initSuccess) {
            throw new Error('翻訳サービスの初期化に失敗しました。APIキーを確認してください。');
          }
        }

        // 翻訳実行
        const result = await translationService.translate(text, targetLanguage, sourceLanguage);

        return {
          success: true,
          result: result,
        };
      } catch (error) {
        console.error('Translation failed:', error);
        return {
          success: false,
          error: error.message,
          errorType: getTranslationErrorType(error),
        };
      }
    },
  );

  // 翻訳設定の取得
  ipcMain.handle('get-translation-settings', async () => {
    try {
      return settingsStore.getTranslationSettings();
    } catch (error) {
      console.error('Failed to get translation settings:', error);
      throw error;
    }
  });

  // 翻訳設定の保存
  ipcMain.handle('set-translation-settings', async (event, settings) => {
    try {
      settingsStore.setTranslationSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Failed to save translation settings:', error);
      throw error;
    }
  });

  // 翻訳サービスの状態確認
  ipcMain.handle('check-translation-service', async () => {
    try {
      const healthCheck = await translationService.healthCheck();
      return {
        success: true,
        status: healthCheck,
      };
    } catch (error) {
      console.error('Translation service health check failed:', error);
      return {
        success: false,
        error: error.message,
        status: {
          status: 'unhealthy',
          errors: [error.message],
        },
      };
    }
  });
}

/**
 * 翻訳エラーの種別を判定する
 * @param {Error} error エラーオブジェクト
 * @returns {string} エラー種別
 */
function getTranslationErrorType(error) {
  const message = error.message?.toLowerCase() || '';

  if (
    message.includes('api key') ||
    message.includes('keychain') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return 'api_key';
  } else if (message.includes('429') || message.includes('quota') || message.includes('limit')) {
    return 'quota_exceeded';
  } else if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection')
  ) {
    return 'network';
  } else if (message.includes('invalid') || message.includes('validation')) {
    return 'validation';
  } else {
    return 'unknown';
  }
}

/**
 * アプリが終了する前の処理
 */
app.on('before-quit', (_event) => {
  // ウィンドウのクリーンアップ
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.destroy();
    settingsWindow = null;
  }

  if (hudWindowManager) {
    hudWindowManager.destroy();
    hudWindowManager = null;
  }

  // サービスのクリーンアップ
  settingsStore = null;
  keychainManager = null;
  translationService = null;
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
