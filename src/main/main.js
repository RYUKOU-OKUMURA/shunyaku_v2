const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const HUDWindowManager = require('./HUDWindowManager');

// Services
const SettingsStore = require('../services/SettingsStore');
const KeychainManager = require('../services/KeychainManager');
const TranslationService = require('../services/TranslationService');
const AppLifecycleManager = require('../services/AppLifecycleManager');
const CaptureService = require('../services/CaptureService');
const OCRService = require('../services/OCRService');
const GlobalShortcutManager = require('../services/GlobalShortcutManager');

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
let appLifecycleManager = null;
let captureService = null;
let ocrService = null;
let globalShortcutManager = null;

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
  captureService = new CaptureService();
  ocrService = new OCRService();

  // AppLifecycleManagerを初期化（権限チェック）
  appLifecycleManager = new AppLifecycleManager();
  const permissionsGranted = await appLifecycleManager.initialize();

  if (!permissionsGranted) {
    // 権限が不足している場合、AppLifecycleManagerがガイドを表示
    // ユーザーがアプリを終了するか設定を完了するまで待機
    console.log('Application waiting for permissions...');
    return;
  }

  // HUDウィンドウマネージャーを初期化
  hudWindowManager = new HUDWindowManager();

  // グローバルショートカットマネージャーを初期化
  globalShortcutManager = new GlobalShortcutManager();
  await globalShortcutManager.initialize(settingsStore);

  // グローバルアプリ参照を設定（ショートカットコールバック用）
  global.mainApp = {
    triggerCapture: () => triggerCaptureWorkflow(),
    showSettings: () => createSettingsWindow(),
  };

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
    }
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

  // 権限管理関連のIPC（タスク3.1）
  ipcMain.handle('check-screen-recording-permission', async () => {
    try {
      if (appLifecycleManager) {
        const hasPermission = await appLifecycleManager.checkScreenRecordingPermission();
        return {
          success: true,
          hasPermission: hasPermission,
          status: appLifecycleManager.getPermissionStatus(),
        };
      } else {
        return {
          success: false,
          hasPermission: false,
          status: {},
          error: 'AppLifecycleManager not initialized',
        };
      }
    } catch (error) {
      console.error('Screen recording permission check failed:', error);
      return {
        success: false,
        hasPermission: false,
        status: {},
        error: error.message,
      };
    }
  });

  ipcMain.handle('recheck-permissions', async () => {
    try {
      if (appLifecycleManager) {
        const hasPermissions = await appLifecycleManager.recheckPermissions();
        return {
          success: true,
          hasPermissions: hasPermissions,
          status: appLifecycleManager.getPermissionStatus(),
        };
      } else {
        return {
          success: false,
          hasPermissions: false,
          status: {},
          error: 'AppLifecycleManager not initialized',
        };
      }
    } catch (error) {
      console.error('Permission recheck failed:', error);
      return {
        success: false,
        hasPermissions: false,
        status: {},
        error: error.message,
      };
    }
  });

  ipcMain.handle('open-system-preferences', async () => {
    try {
      if (appLifecycleManager) {
        await appLifecycleManager.openSystemPreferences();
        return { success: true };
      } else {
        throw new Error('AppLifecycleManager not initialized');
      }
    } catch (error) {
      console.error('Failed to open system preferences:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // スクリーンキャプチャ関連のIPC（タスク3.2）
  ipcMain.handle('get-available-screens', async () => {
    try {
      if (captureService) {
        const screens = await captureService.getAvailableSources();
        return {
          success: true,
          screens: screens,
        };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to get available screens:', error);
      return {
        success: false,
        screens: [],
        error: error.message,
      };
    }
  });

  ipcMain.handle('capture-screen', async (event, sourceId = null) => {
    try {
      if (captureService) {
        const imagePath = await captureService.captureScreen(sourceId);
        return {
          success: true,
          imagePath: imagePath,
        };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to capture screen:', error);
      return {
        success: false,
        imagePath: null,
        error: error.message,
      };
    }
  });

  ipcMain.handle('capture-high-res-screen', async (event, sourceId) => {
    try {
      if (captureService) {
        const imagePath = await captureService.captureHighResolutionScreen(sourceId);
        return {
          success: true,
          imagePath: imagePath,
        };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to capture high-res screen:', error);
      return {
        success: false,
        imagePath: null,
        error: error.message,
      };
    }
  });

  ipcMain.handle('capture-all-screens', async () => {
    try {
      if (captureService) {
        const captures = await captureService.captureAllScreens();
        return {
          success: true,
          captures: captures,
        };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to capture all screens:', error);
      return {
        success: false,
        captures: [],
        error: error.message,
      };
    }
  });

  ipcMain.handle('cleanup-temp-files', async () => {
    try {
      if (captureService) {
        await captureService.cleanupTempFiles();
        return { success: true };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('delete-temp-file', async (event, filePath) => {
    try {
      if (captureService) {
        await captureService.deleteTempFile(filePath);
        return { success: true };
      } else {
        throw new Error('CaptureService not initialized');
      }
    } catch (error) {
      console.error('Failed to delete temp file:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // OCRサービス関連のIPC（タスク3.3）
  ipcMain.handle('perform-ocr', async (event, imagePath, options = {}) => {
    try {
      if (!ocrService) {
        throw new Error('OCRService not initialized');
      }

      const result = await ocrService.performOCR(imagePath, options);
      return {
        success: true,
        result: result,
      };
    } catch (error) {
      console.error('OCR failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('check-ocr-health', async () => {
    try {
      if (!ocrService) {
        throw new Error('OCRService not initialized');
      }

      const health = await ocrService.performHealthCheck();
      return {
        success: true,
        health: health,
      };
    } catch (error) {
      console.error('OCR health check failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // 完全フロー統合のIPC（タスク3.4）
  ipcMain.handle('execute-full-workflow', async (event, options = {}) => {
    return await executeFullTranslationWorkflow(options);
  });

  // ショートカット経由でのフロー実行
  ipcMain.handle('execute-shortcut-workflow', async () => {
    try {
      const { screen } = require('electron');
      const mousePosition = screen.getCursorScreenPoint();

      const result = await executeFullTranslationWorkflow({
        triggerMethod: 'shortcut',
        mousePosition: mousePosition,
      });

      return result;
    } catch (error) {
      console.error('Shortcut workflow failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // グローバルショートカット関連のIPC（タスク3.6）
  ipcMain.handle('get-registered-shortcuts', async () => {
    try {
      if (globalShortcutManager) {
        const shortcuts = globalShortcutManager.getRegisteredShortcuts();
        return {
          success: true,
          shortcuts: shortcuts,
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to get registered shortcuts:', error);
      return {
        success: false,
        shortcuts: {},
        error: error.message,
      };
    }
  });

  ipcMain.handle('register-shortcut', async (event, action, accelerator) => {
    try {
      if (globalShortcutManager) {
        const success = await globalShortcutManager.registerShortcut(action, accelerator);
        return {
          success: success,
          message: success ? 'Shortcut registered successfully' : 'Failed to register shortcut',
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to register shortcut:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('unregister-shortcut', async (event, action) => {
    try {
      if (globalShortcutManager) {
        const success = globalShortcutManager.unregisterShortcut(action);
        return {
          success: success,
          message: success ? 'Shortcut unregistered successfully' : 'Failed to unregister shortcut',
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to unregister shortcut:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('check-shortcut-conflict', async (event, accelerator) => {
    try {
      if (globalShortcutManager) {
        const isConflicting = globalShortcutManager.isShortcutConflicting(accelerator);
        return {
          success: true,
          isConflicting: isConflicting,
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to check shortcut conflict:', error);
      return {
        success: false,
        isConflicting: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('validate-shortcut', async (event, accelerator) => {
    try {
      if (globalShortcutManager) {
        const isValid = globalShortcutManager.isValidShortcut(accelerator);
        return {
          success: true,
          isValid: isValid,
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to validate shortcut:', error);
      return {
        success: false,
        isValid: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('format-shortcut', async (event, accelerator) => {
    try {
      if (globalShortcutManager) {
        const formatted = globalShortcutManager.formatShortcutForDisplay(accelerator);
        return {
          success: true,
          formatted: formatted,
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to format shortcut:', error);
      return {
        success: false,
        formatted: accelerator,
        error: error.message,
      };
    }
  });

  ipcMain.handle('restore-default-shortcuts', async () => {
    try {
      if (globalShortcutManager) {
        const success = await globalShortcutManager.restoreDefaults();
        return {
          success: success,
          message: success ? 'Default shortcuts restored' : 'Failed to restore defaults',
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to restore default shortcuts:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('export-shortcut-settings', async () => {
    try {
      if (globalShortcutManager) {
        const settings = globalShortcutManager.exportSettings();
        return {
          success: true,
          settings: settings,
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to export shortcut settings:', error);
      return {
        success: false,
        settings: null,
        error: error.message,
      };
    }
  });

  ipcMain.handle('import-shortcut-settings', async (event, settings) => {
    try {
      if (globalShortcutManager) {
        const success = await globalShortcutManager.importSettings(settings);
        return {
          success: success,
          message: success ? 'Shortcut settings imported' : 'Failed to import settings',
        };
      } else {
        throw new Error('GlobalShortcutManager not initialized');
      }
    } catch (error) {
      console.error('Failed to import shortcut settings:', error);
      return {
        success: false,
        error: error.message,
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
app.on('before-quit', async (_event) => {
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
  if (appLifecycleManager) {
    appLifecycleManager.destroy();
    appLifecycleManager = null;
  }

  if (captureService) {
    captureService.shutdown();
    captureService = null;
  }

  if (ocrService) {
    await ocrService.shutdown();
    ocrService = null;
  }

  if (globalShortcutManager) {
    globalShortcutManager.cleanup();
    globalShortcutManager = null;
  }

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

/**
 * グローバルショートカットから呼び出される翻訳ワークフローのトリガー関数
 * 現在のマウス位置を取得してワークフローを実行します
 */
async function triggerCaptureWorkflow() {
  try {
    console.log('🔥 Global shortcut triggered - starting capture workflow');

    const { screen } = require('electron');
    const mousePosition = screen.getCursorScreenPoint();

    const result = await executeFullTranslationWorkflow({
      triggerMethod: 'global_shortcut',
      mousePosition: mousePosition,
    });

    if (result.success) {
      console.log('✅ Global shortcut workflow completed successfully');
    } else {
      console.error('❌ Global shortcut workflow failed:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Global shortcut workflow error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 完全翻訳ワークフローの実行（タスク3.4メインメソッド）
 * Capture → OCR → Translation → HUD表示の一連のフローを実行
 *
 * @param {Object} options - 実行オプション
 * @param {string} options.triggerMethod - トリガー方法 ('shortcut', 'manual')
 * @param {Object} options.mousePosition - マウス位置 {x, y}
 * @param {string} options.sourceId - キャプチャソースID
 * @returns {Promise<Object>} 結果オブジェクト
 */
async function executeFullTranslationWorkflow(options = {}) {
  const startTime = Date.now();
  const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // パフォーマンス計測用指標
  const performanceMetrics = {
    workflowId: workflowId,
    startTime: startTime,
    triggerMethod: options.triggerMethod || 'unknown',
    phases: {},
    totalTime: null,
    success: false,
  };

  try {
    console.log(`✨ Starting full translation workflow [${workflowId}]`);
    console.log('Options:', JSON.stringify(options, null, 2));

    // Phase 1: 初期化チェック
    const initStartTime = Date.now();
    const initResult = await checkWorkflowPrerequisites();
    performanceMetrics.phases.initialization = {
      startTime: initStartTime,
      duration: Date.now() - initStartTime,
      success: initResult.success,
    };

    if (!initResult.success) {
      throw new Error(`Initialization failed: ${initResult.error}`);
    }

    // Phase 2: スクリーンキャプチャ
    const captureStartTime = Date.now();
    console.log('📷 Phase 2: Screen capture starting...');

    const imagePath = await captureService.captureScreen(options.sourceId);

    if (!imagePath || typeof imagePath !== 'string') {
      throw new Error('Screen capture failed: Invalid result');
    }
    performanceMetrics.phases.capture = {
      startTime: captureStartTime,
      duration: Date.now() - captureStartTime,
      success: true,
      imagePath: imagePath,
    };

    console.log(`✅ Screen capture completed: ${imagePath}`);

    // Phase 3 & 4: OCRと翻訳サービス初期化の並列処理（パフォーマンス最適化）
    const ocrStartTime = Date.now();
    console.log('🔍 Phase 3: OCR processing starting...');

    const translationSettings = settingsStore.getTranslationSettings();
    const ocrLanguage = determineOCRLanguage(translationSettings);

    // OCRと翻訳サービス初期化を並列実行
    const [ocrResult, translationInitResult] = await Promise.allSettled([
      ocrService.performOCR(imagePath, {
        language: ocrLanguage,
        preprocess: true,
        minConfidence: 60,
        returnDetails: true,
      }),
      translationService.isInitialized() ? Promise.resolve(true) : translationService.initialize(),
    ]);

    // OCR結果の処理
    if (ocrResult.status === 'rejected' || !ocrResult.value.success) {
      throw new Error(
        `OCR failed: ${ocrResult.reason?.message || ocrResult.value?.error || 'Unknown error'}`
      );
    }

    const ocrData = ocrResult.value;
    if (!ocrData.text || ocrData.text.trim().length === 0) {
      throw new Error('OCR failed: No text detected');
    }

    performanceMetrics.phases.ocr = {
      startTime: ocrStartTime,
      duration: Date.now() - ocrStartTime,
      success: true,
      confidence: ocrData.confidence,
      textLength: ocrData.text.length,
    };

    console.log(
      `✅ OCR completed: "${ocrData.text.substring(0, 50)}..." (confidence: ${ocrData.confidence}%)`
    );

    // 翻訳サービス初期化結果の確認
    if (translationInitResult.status === 'rejected' || !translationInitResult.value) {
      throw new Error('Translation service initialization failed');
    }

    // Phase 4: 翻訳処理
    const translationStartTime = Date.now();
    console.log('🌍 Phase 4: Translation starting...');

    const translationResult = await translationService.translate(
      ocrData.text,
      'auto',
      translationSettings.targetLanguage || 'ja'
    );

    performanceMetrics.phases.translation = {
      startTime: translationStartTime,
      duration: Date.now() - translationStartTime,
      success: translationResult.success,
      sourceLanguage: translationResult.sourceLanguage,
      targetLanguage: translationResult.targetLanguage,
    };

    if (!translationResult.success) {
      throw new Error(`Translation failed: ${translationResult.error}`);
    }

    console.log(`✅ Translation completed: "${translationResult.text.substring(0, 50)}..."`);

    // Phase 5: HUD表示
    const hudStartTime = Date.now();
    console.log('💬 Phase 5: HUD display starting...');

    const hudData = {
      originalText: ocrData.text,
      translatedText: translationResult.text,
      sourceLanguage: translationResult.sourceLanguage,
      targetLanguage: translationResult.targetLanguage,
      confidence: ocrData.confidence,
      workflowId: workflowId,
      timestamp: new Date().toISOString(),
    };

    // HUDをマウス位置近くに表示
    const mousePosition =
      options.mousePosition || require('electron').screen.getCursorScreenPoint();
    await hudWindowManager.showHUDWithTranslation(mousePosition, hudData);

    performanceMetrics.phases.hudDisplay = {
      startTime: hudStartTime,
      duration: Date.now() - hudStartTime,
      success: true,
      mousePosition: mousePosition,
    };

    console.log(`✅ HUD displayed at position (${mousePosition.x}, ${mousePosition.y})`);

    // 一時ファイルのクリーンアップを並列で実行（パフォーマンス最適化）
    const cleanupPromise = captureService.deleteTempFile(imagePath).catch((cleanupError) => {
      console.warn('Temp file cleanup warning:', cleanupError.message);
    });

    // 成功時のメトリクス納作
    performanceMetrics.totalTime = Date.now() - startTime;
    performanceMetrics.success = true;

    console.log(
      `✨ Workflow completed successfully in ${performanceMetrics.totalTime}ms [${workflowId}]`
    );
    logPerformanceMetrics(performanceMetrics);

    // 非同期でクリーンアップを継続
    cleanupPromise;

    return {
      success: true,
      workflowId: workflowId,
      result: {
        original: ocrData.text,
        translated: translationResult.text,
        confidence: ocrData.confidence,
        sourceLanguage: translationResult.sourceLanguage,
        targetLanguage: translationResult.targetLanguage,
      },
      performance: performanceMetrics,
      hudDisplayed: true,
    };
  } catch (error) {
    // エラー時のメトリクス納作
    performanceMetrics.totalTime = Date.now() - startTime;
    performanceMetrics.success = false;
    performanceMetrics.error = error.message;
    performanceMetrics.errorType = categorizeError(error);

    console.error(
      `❌ Workflow failed after ${performanceMetrics.totalTime}ms [${workflowId}]:`,
      error
    );
    logPerformanceMetrics(performanceMetrics);

    // HUDにエラー情報を表示
    try {
      const mousePosition =
        options.mousePosition || require('electron').screen.getCursorScreenPoint();
      await hudWindowManager.showHUDWithError(mousePosition, {
        error: getHumanReadableError(error, performanceMetrics.errorType),
        workflowId: workflowId,
        timestamp: new Date().toISOString(),
        phase: getCurrentPhase(performanceMetrics),
        errorType: performanceMetrics.errorType,
        suggestions: getErrorSuggestions(performanceMetrics.errorType),
      });
    } catch (hudError) {
      console.error('Failed to display error HUD:', hudError);
    }

    return {
      success: false,
      error: error.message,
      errorType: performanceMetrics.errorType,
      workflowId: workflowId,
      performance: performanceMetrics,
      phase: getCurrentPhase(performanceMetrics),
    };
  }
}

/**
 * ワークフローの前提条件をチェック
 * @returns {Promise<Object>} チェック結果
 */
async function checkWorkflowPrerequisites() {
  const checks = {
    permissions: false,
    captureService: false,
    ocrService: false,
    translationService: false,
    hudWindowManager: false,
  };

  try {
    // 権限チェック
    if (appLifecycleManager) {
      checks.permissions = await appLifecycleManager.checkScreenRecordingPermission();
    }

    // サービス初期化チェック
    checks.captureService = captureService !== null;
    checks.ocrService = ocrService !== null;
    checks.translationService = translationService !== null && translationService.isInitialized();
    checks.hudWindowManager = hudWindowManager !== null;

    const allPassed = Object.values(checks).every((check) => check === true);

    return {
      success: allPassed,
      checks: checks,
      error: allPassed ? null : 'Some prerequisites are not met',
    };
  } catch (error) {
    return {
      success: false,
      checks: checks,
      error: error.message,
    };
  }
}

/**
 * OCR言語を翻訳設定から決定
 * @param {Object} translationSettings - 翻訳設定
 * @returns {string} OCR言語コード
 */
function determineOCRLanguage(translationSettings) {
  const sourceLanguage = translationSettings.sourceLanguage || 'auto';

  // 自動検出の場合は英日対応
  if (sourceLanguage === 'auto') {
    return 'eng+jpn';
  }

  // 具体的な言語が指定されている場合
  switch (sourceLanguage) {
    case 'en':
      return 'eng';
    case 'ja':
      return 'jpn';
    case 'ko':
      return 'kor';
    case 'zh':
      return 'chi_sim';
    default:
      return 'eng+jpn'; // フォールバック
  }
}

/**
 * パフォーマンスメトリクスをログ出力
 * @param {Object} metrics - パフォーマンス指標
 */
function logPerformanceMetrics(metrics) {
  console.log('\n⚙️  Performance Metrics:');
  console.log(`   • Workflow ID: ${metrics.workflowId}`);
  console.log(`   • Total Time: ${metrics.totalTime}ms`);
  console.log(`   • Success: ${metrics.success}`);
  console.log(`   • Trigger: ${metrics.triggerMethod}`);

  if (metrics.phases) {
    console.log('   • Phase Breakdown:');
    Object.entries(metrics.phases).forEach(([phase, data]) => {
      console.log(`     - ${phase}: ${data.duration}ms (${data.success ? '✅' : '❌'})`);
    });
  }

  if (!metrics.success && metrics.error) {
    console.log(`   • Error: ${metrics.error}`);
  }

  // 6秒以内目標のチェック
  if (metrics.totalTime > 6000) {
    console.warn(`⚠️  Performance warning: Workflow took ${metrics.totalTime}ms (target: <6000ms)`);
  } else if (metrics.success) {
    console.log(`✅ Performance target met: ${metrics.totalTime}ms < 6000ms`);
  }

  console.log(''); // 空行
}

/**
 * 現在のフェーズを特定
 * @param {Object} metrics - パフォーマンス指標
 * @returns {string} フェーズ名
 */
function getCurrentPhase(metrics) {
  if (!metrics.phases) {
    return 'unknown';
  }

  const phases = Object.keys(metrics.phases);
  const lastPhase = phases[phases.length - 1];
  return lastPhase || 'initialization';
}

/**
 * エラーのカテゴリ分け（タスク3.4.3）
 * @param {Error} error - エラーオブジェクト
 * @returns {string} エラーカテゴリ
 */
function categorizeError(error) {
  const message = error.message?.toLowerCase() || '';
  const stack = error.stack?.toLowerCase() || '';

  // 権限関連エラー
  if (
    message.includes('permission') ||
    message.includes('access denied') ||
    message.includes('screen recording')
  ) {
    return 'permission';
  }

  // APIキー関連エラー
  if (
    message.includes('api key') ||
    message.includes('keychain') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return 'api_key';
  }

  // ネットワークエラー
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('enotfound') ||
    message.includes('econnreset')
  ) {
    return 'network';
  }

  // OCR関連エラー
  if (
    message.includes('ocr') ||
    message.includes('tesseract') ||
    message.includes('no text detected') ||
    stack.includes('ocrservice')
  ) {
    return 'ocr';
  }

  // キャプチャ関連エラー
  if (
    message.includes('capture') ||
    message.includes('screenshot') ||
    stack.includes('captureservice')
  ) {
    return 'capture';
  }

  // 翻訳関連エラー
  if (
    message.includes('translation') ||
    message.includes('deepl') ||
    message.includes('429') ||
    stack.includes('translationservice')
  ) {
    return 'translation';
  }

  // リソース関連エラー
  if (message.includes('memory') || message.includes('disk') || message.includes('enospc')) {
    return 'resource';
  }

  // 初期化エラー
  if (
    message.includes('initialization') ||
    message.includes('not initialized') ||
    message.includes('setup')
  ) {
    return 'initialization';
  }

  return 'unknown';
}

/**
 * ユーザーフレンドリーなエラーメッセージを生成
 * @param {Error} error - エラーオブジェクト
 * @param {string} errorType - エラーカテゴリ
 * @returns {string} ユーザーフレンドリーなメッセージ
 */
function getHumanReadableError(error, errorType) {
  const baseMessage = error.message || '不明なエラーが発生しました';

  switch (errorType) {
    case 'permission':
      return 'スクリーンキャプチャの権限が不足しています。システム環境設定で権限を許可してください。';

    case 'api_key':
      return 'DeepL APIキーが設定されていないか、無効です。設定画面でAPIキーを確認してください。';

    case 'network':
      return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';

    case 'ocr':
      return 'テキスト認識（OCR）に失敗しました。画像が鮮明か、テキストが読み取りやすいか確認してください。';

    case 'capture':
      return 'スクリーンキャプチャに失敗しました。権限設定を確認してください。';

    case 'translation':
      return '翻訳サービスに問題があります。APIキーや使用量を確認してください。';

    case 'resource':
      return 'システムリソースが不足しています。メモリやディスク容量を確認してください。';

    case 'initialization':
      return 'アプリケーションの初期化に失敗しました。アプリを再起動してください。';

    default:
      return baseMessage.length > 100 ? baseMessage.substring(0, 100) + '...' : baseMessage;
  }
}

/**
 * エラータイプ別の解決提案を生成
 * @param {string} errorType - エラーカテゴリ
 * @returns {string[]} 解決提案の配列
 */
function getErrorSuggestions(errorType) {
  switch (errorType) {
    case 'permission':
      return [
        'システム環境設定を開いて、プライバシーとセキュリティからスクリーン録画権限を許可',
        'アプリを再起動して権限を再確認',
      ];

    case 'api_key':
      return [
        '設定画面からDeepL APIキーを正しく入力',
        'DeepLのアカウント情報とAPIキーの有効性を確認',
      ];

    case 'network':
      return [
        'インターネット接続を確認',
        'ファイアウォール設定でアプリを許可',
        'しばらく時間を置いてから再試行',
      ];

    case 'ocr':
      return [
        'より鮮明な画像や高解像度のスクリーンショットを使用',
        '文字サイズが大きい範囲を選択',
        '背景と文字のコントラストが高い範囲を選択',
      ];

    case 'capture':
      return ['スクリーンキャプチャの権限を再確認', 'アプリを再起動'];

    case 'translation':
      return ['DeepL APIの使用量を確認', 'APIキーの有効性を確認', 'しばらく時間を置いてから再試行'];

    default:
      return ['アプリを再起動してみてください', '問題が続く場合はサポートにお問い合わせください'];
  }
}
