/**
 * GlobalShortcutManagerのユニットテスト（タスク3.6）
 * グローバルショートカット機能のテスト
 */

const GlobalShortcutManager = require('../src/services/GlobalShortcutManager');

// Electronモジュールのモック
jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: jest.fn(() => ({
      // Mock window object
    })),
  },
  dialog: {
    showMessageBox: jest.fn(),
  },
}));

const { globalShortcut, dialog } = require('electron');

// 設定ストアのモック
const mockSettingsStore = {
  getShortcutSettings: jest.fn(),
  onDidChange: jest.fn(),
};

describe('GlobalShortcutManager', () => {
  let manager;
  let mockCallbacks;

  beforeEach(() => {
    // テストごとに新しいインスタンスを作成
    manager = new GlobalShortcutManager();
    
    // コールバック関数のモック
    mockCallbacks = {
      translate: jest.fn(),
      showSettings: jest.fn(),
      toggleHUD: jest.fn(),
    };

    // 設定ストアのモック設定
    mockSettingsStore.getShortcutSettings.mockReturnValue({
      translate: 'CommandOrControl+Shift+T',
      showSettings: 'CommandOrControl+Comma',
      toggleHUD: 'CommandOrControl+Shift+H',
    });

    // Electronモックの初期化
    globalShortcut.register.mockClear();
    globalShortcut.unregister.mockClear();
    globalShortcut.unregisterAll.mockClear();
    globalShortcut.isRegistered.mockClear();
    dialog.showMessageBox.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('3.6.1 globalShortcutモジュール実装', () => {
    test('GlobalShortcutManagerが正しく初期化される', () => {
      expect(manager).toBeInstanceOf(GlobalShortcutManager);
      expect(manager.isInitialized).toBe(false);
      expect(manager.registeredShortcuts).toBeInstanceOf(Map);
      expect(manager.callbacks).toBeInstanceOf(Map);
    });

    test('デフォルトショートカットが定義されている', () => {
      const defaults = manager.getAvailableShortcuts();
      
      expect(defaults.translate).toBeDefined();
      expect(defaults.translate.accelerator).toBe('CommandOrControl+Shift+T');
      expect(defaults.translate.description).toBeDefined();
      
      expect(defaults.showSettings).toBeDefined();
      expect(defaults.showSettings.accelerator).toBe('CommandOrControl+Comma');
      
      expect(defaults.toggleHUD).toBeDefined();
      expect(defaults.toggleHUD.accelerator).toBe('CommandOrControl+Shift+H');
    });
  });

  describe('3.6.2 デフォルトショートカット設定', () => {
    test('初期化時にデフォルトショートカットが登録される', async () => {
      // globalShortcut.registerが成功を返すように設定
      globalShortcut.register.mockReturnValue(true);

      const success = await manager.initialize(mockSettingsStore, mockCallbacks);

      expect(success).toBe(true);
      expect(manager.isInitialized).toBe(true);
      
      // 3つのショートカットが登録されることを確認
      expect(globalShortcut.register).toHaveBeenCalledTimes(3);
      
      // 各ショートカットが正しく登録されることを確認
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+T',
        expect.any(Function)
      );
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Comma',
        expect.any(Function)
      );
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+H',
        expect.any(Function)
      );
    });

    test('ショートカットのコールバック関数が正しく設定される', async () => {
      globalShortcut.register.mockImplementation((accelerator, callback) => {
        // コールバック関数を即座に実行してテスト
        if (accelerator === 'CommandOrControl+Shift+T') {
          callback();
        }
        return true;
      });

      await manager.initialize(mockSettingsStore, mockCallbacks);

      // 翻訳ショートカットのコールバックが呼ばれることを確認
      expect(mockCallbacks.translate).toHaveBeenCalledWith(
        'translate',
        'CommandOrControl+Shift+T'
      );
    });
  });

  describe('3.6.3 ショートカット登録・解除ロジック', () => {
    test('個別ショートカットの登録が正常に動作する', async () => {
      globalShortcut.register.mockReturnValue(true);

      const success = await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      expect(success).toBe(true);
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+Shift+T',
        expect.any(Function)
      );
      expect(manager.registeredShortcuts.has('translate')).toBe(true);
    });

    test('個別ショートカットの解除が正常に動作する', async () => {
      // 先に登録
      globalShortcut.register.mockReturnValue(true);
      await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      // 解除をテスト
      const success = await manager.unregisterShortcut('translate');

      expect(success).toBe(true);
      expect(globalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+Shift+T');
      expect(manager.registeredShortcuts.has('translate')).toBe(false);
    });

    test('全ショートカットの解除が正常に動作する', async () => {
      // 複数のショートカットを登録
      globalShortcut.register.mockReturnValue(true);
      await manager.initialize(mockSettingsStore, mockCallbacks);

      // 全て解除
      await manager.unregisterAll();

      expect(globalShortcut.unregister).toHaveBeenCalledTimes(3);
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(manager.registeredShortcuts.size).toBe(0);
    });

    test('ショートカット設定の更新が正常に動作する', async () => {
      globalShortcut.register.mockReturnValue(true);
      globalShortcut.unregister.mockReturnValue(true);
      
      // 初期化
      await manager.initialize(mockSettingsStore, mockCallbacks);
      
      // 新しい設定で更新
      const newSettings = {
        translate: 'CommandOrControl+Alt+T',
        showSettings: 'CommandOrControl+Period',
        toggleHUD: 'CommandOrControl+Alt+H',
      };

      const success = await manager.updateShortcuts(newSettings);

      expect(success).toBe(true);
      // 既存のものを解除してから新しいものを登録
      expect(globalShortcut.unregister).toHaveBeenCalledTimes(3);
      expect(globalShortcut.register).toHaveBeenCalledTimes(6); // 初期化時3 + 更新時3
    });
  });

  describe('3.6.4 設定画面でのショートカットカスタマイズUI', () => {
    test('アクセレレーターの検証が正常に動作する', () => {
      // 有効なアクセレレーター
      expect(manager.validateAccelerator('CommandOrControl+Shift+T')).toBe(true);
      expect(manager.validateAccelerator('Command+Alt+A')).toBe(true);
      expect(manager.validateAccelerator('Ctrl+Shift+F1')).toBe(true);

      // 無効なアクセレレーター
      expect(manager.validateAccelerator('')).toBe(false);
      expect(manager.validateAccelerator('T')).toBe(false);
      expect(manager.validateAccelerator('InvalidKey+T')).toBe(false);
      expect(manager.validateAccelerator(null)).toBe(false);
    });

    test('ショートカット競合チェックが正常に動作する', async () => {
      globalShortcut.register.mockReturnValue(true);
      
      // 既存のショートカットを登録
      await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      // 同じアクセレレーターで競合をチェック
      const conflict = manager.checkConflicts('CommandOrControl+Shift+T');

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.type).toBe('internal');
      expect(conflict.conflictWith).toBe('translate');
    });

    test('システムショートカットとの競合検出が動作する', () => {
      const conflict = manager.checkConflicts('CommandOrControl+C');

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.type).toBe('system');
      expect(conflict.conflictWith).toBe('System shortcut');
    });

    test('競合処理ダイアログが表示される', async () => {
      // ダイアログで「続行」を選択
      dialog.showMessageBox.mockResolvedValue({ response: 0 });

      const shouldContinue = await manager.handleConflict(
        {
          hasConflict: true,
          type: 'internal',
          conflictWith: 'existing',
          description: 'Test conflict',
        },
        'translate',
        'CommandOrControl+Shift+T'
      );

      expect(shouldContinue).toBe(true);
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          type: 'warning',
          title: 'Shunyaku v2 - Shortcut Conflict',
          buttons: ['Continue', 'Cancel'],
        })
      );
    });
  });

  describe('3.6.5 競合検出と警告表示', () => {
    test('登録されているショートカット情報を取得できる', async () => {
      globalShortcut.register.mockReturnValue(true);
      
      await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      const shortcuts = manager.getRegisteredShortcuts();

      expect(shortcuts.translate).toBeDefined();
      expect(shortcuts.translate.accelerator).toBe('CommandOrControl+Shift+T');
      expect(shortcuts.translate.description).toBeDefined();
      expect(shortcuts.translate.registeredAt).toBeDefined();
    });

    test('ショートカットの登録状態をチェックできる', async () => {
      globalShortcut.register.mockReturnValue(true);
      
      await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      expect(manager.isShortcutRegistered('translate')).toBe(true);
      expect(manager.isShortcutRegistered('nonexistent')).toBe(false);
    });

    test('アクセレレーターの利用可能性をチェックできる', () => {
      globalShortcut.isRegistered.mockReturnValue(false);
      
      expect(manager.isAcceleratorAvailable('CommandOrControl+Shift+T')).toBe(true);

      globalShortcut.isRegistered.mockReturnValue(true);
      
      expect(manager.isAcceleratorAvailable('CommandOrControl+Shift+T')).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    test('ショートカット登録失敗時のエラーハンドリング', async () => {
      globalShortcut.register.mockReturnValue(false);

      const success = await manager.registerShortcut(
        'translate',
        'CommandOrControl+Shift+T',
        mockCallbacks.translate
      );

      expect(success).toBe(false);
      expect(manager.registeredShortcuts.has('translate')).toBe(false);
    });

    test('無効なアクセレレーター形式のエラーハンドリング', async () => {
      const success = await manager.registerShortcut(
        'translate',
        'invalid-accelerator',
        mockCallbacks.translate
      );

      expect(success).toBe(false);
      expect(globalShortcut.register).not.toHaveBeenCalled();
    });

    test('初期化エラーのハンドリング', async () => {
      mockSettingsStore.getShortcutSettings.mockImplementation(() => {
        throw new Error('Settings error');
      });

      const success = await manager.initialize(mockSettingsStore, mockCallbacks);

      expect(success).toBe(false);
      expect(manager.isInitialized).toBe(false);
    });
  });

  describe('サービス終了処理', () => {
    test('shutdown時に適切にクリーンアップされる', async () => {
      globalShortcut.register.mockReturnValue(true);
      
      // 初期化してショートカットを登録
      await manager.initialize(mockSettingsStore, mockCallbacks);

      // シャットダウン
      await manager.shutdown();

      expect(globalShortcut.unregister).toHaveBeenCalledTimes(3);
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(manager.callbacks.size).toBe(0);
      expect(manager.registeredShortcuts.size).toBe(0);
      expect(manager.isInitialized).toBe(false);
    });
  });

  describe('デバッグ機能', () => {
    test('デバッグ情報を取得できる', async () => {
      globalShortcut.register.mockReturnValue(true);
      await manager.initialize(mockSettingsStore, mockCallbacks);

      const debugInfo = manager.getDebugInfo();

      expect(debugInfo.isInitialized).toBe(true);
      expect(debugInfo.registeredCount).toBe(3);
      expect(debugInfo.registeredShortcuts).toBeDefined();
      expect(debugInfo.callbackCount).toBe(3);
      expect(debugInfo.electronGlobalShortcuts).toBeDefined();
    });
  });
});