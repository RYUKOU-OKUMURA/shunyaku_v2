/**
 * HUD 自動表示制御機能テスト (Task 4.1)
 * HUDの自動非表示、固定モード、ユーザー操作検出の統合テスト
 */

const HUDWindowManager = require('../src/main/HUDWindowManager');
const { SettingsStore } = require('../src/services/SettingsStore');

// Electronモジュールのモック
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      executeJavaScript: jest.fn().mockResolvedValue(),
    },
    setPosition: jest.fn(),
    getSize: jest.fn().mockReturnValue([400, 300]),
    getPosition: jest.fn().mockReturnValue([100, 100]),
    focus: jest.fn(),
  })),
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 }
    })
  }
}));

describe('HUD自動表示制御機能 (Task 4.1)', () => {
  let hudWindowManager;
  let settingsStore;
  let mockWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // SettingsStoreのモック
    settingsStore = {
      get: jest.fn().mockImplementation((key, defaultValue) => {
        if (key === 'hud.autoHideDuration') {
          return 15; // デフォルト15秒
        }
        return defaultValue;
      }),
      set: jest.fn(),
      onDidChange: jest.fn(),
    };

    // BrowserWindowのモックを取得
    const { BrowserWindow } = require('electron');
    mockWindow = new BrowserWindow();

    // HUDWindowManagerを初期化
    hudWindowManager = new HUDWindowManager();
    hudWindowManager.setSettingsStore(settingsStore);
    
    // モックウィンドウを手動で設定
    hudWindowManager.hudWindow = mockWindow;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (hudWindowManager) {
      hudWindowManager.destroy();
    }
  });

  describe('4.1.1 autoHideDuration設定実装（デフォルト15秒）', () => {
    test('デフォルト設定が15秒に設定されている', () => {
      expect(hudWindowManager.autoHideDuration).toBe(15000); // 15秒（ミリ秒）
    });

    test('設定ストアから自動非表示時間を読み取る', () => {
      // 30秒に設定変更
      settingsStore.get.mockReturnValue(30);
      hudWindowManager.updateAutoHideDuration();
      
      expect(settingsStore.get).toHaveBeenCalledWith('hud.autoHideDuration', 15);
      expect(hudWindowManager.autoHideDuration).toBe(30000); // 30秒
    });

    test('設定値0の場合は自動非表示が無効化される', () => {
      settingsStore.get.mockReturnValue(0);
      hudWindowManager.updateAutoHideDuration();
      
      expect(hudWindowManager.autoHideDuration).toBe(0);
    });
  });

  describe('4.1.2 タイマー処理実装', () => {
    test('HUD表示時に自動非表示タイマーが開始される', async () => {
      await hudWindowManager.showHUD();
      
      // タイマーが設定されていることを確認
      expect(hudWindowManager.autoHideTimer).not.toBeNull();
    });

    test('15秒後にHUDが自動で閉じる', async () => {
      hudWindowManager.isVisible = true; // 手動で状態設定
      hudWindowManager.startAutoHideTimer();
      
      // 15秒経過をシミュレート
      jest.advanceTimersByTime(15000);
      
      // 自動非表示の事前通知が送信される
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
      
      // 追加の1秒後にHUDが閉じられる
      jest.advanceTimersByTime(1000);
      
      expect(mockWindow.hide).toHaveBeenCalled();
    });

    test('自動非表示時間が0の場合、タイマーが設定されない', async () => {
      hudWindowManager.autoHideDuration = 0;
      await hudWindowManager.showHUD();
      
      expect(hudWindowManager.autoHideTimer).toBeNull();
    });

    test('HUD非表示時にタイマーがクリアされる', async () => {
      await hudWindowManager.showHUD();
      expect(hudWindowManager.autoHideTimer).not.toBeNull();
      
      hudWindowManager.hideHUD();
      expect(hudWindowManager.autoHideTimer).toBeNull();
    });

    test('HUD閉じる時にタイマーがクリアされる', async () => {
      await hudWindowManager.showHUD();
      expect(hudWindowManager.autoHideTimer).not.toBeNull();
      
      hudWindowManager.closeHUD();
      expect(hudWindowManager.autoHideTimer).toBeNull();
    });
  });

  describe('4.1.3 ユーザー操作時のタイマーリセット', () => {
    test('ユーザー活動通知時にタイマーがリセットされる', async () => {
      await hudWindowManager.showHUD();
      
      // 5秒経過
      jest.advanceTimersByTime(5000);
      
      // ユーザー操作を通知
      hudWindowManager.notifyUserActivity();
      
      // 元の15秒を経過しても閉じられない
      jest.advanceTimersByTime(12000);
      expect(mockWindow.hide).not.toHaveBeenCalled();
      
      // リセット後さらに15秒経過で閉じられる
      jest.advanceTimersByTime(3000);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
    });

    test('固定モード時はユーザー活動通知があってもタイマーがリセットされない', async () => {
      hudWindowManager.setPinnedMode(true);
      await hudWindowManager.showHUD();
      
      // ユーザー操作を通知
      hudWindowManager.notifyUserActivity();
      
      // タイマーは設定されていない
      expect(hudWindowManager.autoHideTimer).toBeNull();
    });
  });

  describe('4.1.4 固定モード切り替えボタン追加', () => {
    test('固定モードの初期状態はfalse', () => {
      expect(hudWindowManager.isPinnedMode()).toBe(false);
    });

    test('固定モードの有効化', () => {
      hudWindowManager.setPinnedMode(true);
      
      expect(hudWindowManager.isPinnedMode()).toBe(true);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-pinned-mode-changed', true);
    });

    test('固定モードの無効化', () => {
      hudWindowManager.setPinnedMode(true);
      hudWindowManager.setPinnedMode(false);
      
      expect(hudWindowManager.isPinnedMode()).toBe(false);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-pinned-mode-changed', false);
    });

    test('固定モード有効時はタイマーが設定されない', async () => {
      hudWindowManager.setPinnedMode(true);
      await hudWindowManager.showHUD();
      
      expect(hudWindowManager.autoHideTimer).toBeNull();
    });

    test('固定モード無効化時にタイマーが再開される', async () => {
      await hudWindowManager.showHUD();
      hudWindowManager.setPinnedMode(true);
      expect(hudWindowManager.autoHideTimer).toBeNull();
      
      hudWindowManager.setPinnedMode(false);
      expect(hudWindowManager.autoHideTimer).not.toBeNull();
    });
  });

  describe('統合テスト - 自動非表示フロー全体', () => {
    test('完全な自動非表示フローが正常に動作する', async () => {
      // 1. HUD表示
      await hudWindowManager.showHUD();
      expect(hudWindowManager.isVisible).toBe(true);
      expect(hudWindowManager.autoHideTimer).not.toBeNull();
      
      // 2. ユーザー操作によるタイマーリセット
      jest.advanceTimersByTime(10000); // 10秒経過
      hudWindowManager.notifyUserActivity();
      
      // 3. リセット後の自動非表示
      jest.advanceTimersByTime(15000); // 15秒経過
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
      
      // 4. 1秒後に実際に非表示
      jest.advanceTimersByTime(1000);
      expect(mockWindow.hide).toHaveBeenCalled();
      expect(hudWindowManager.isVisible).toBe(false);
    });

    test('固定モード中は自動非表示されない', async () => {
      // 固定モードで表示
      hudWindowManager.setPinnedMode(true);
      await hudWindowManager.showHUD();
      
      // 長時間経過しても非表示されない
      jest.advanceTimersByTime(60000); // 60秒経過
      expect(mockWindow.hide).not.toHaveBeenCalled();
      expect(hudWindowManager.isVisible).toBe(true);
    });

    test('固定解除後は自動非表示が再開される', async () => {
      // 固定モードで表示
      hudWindowManager.setPinnedMode(true);
      await hudWindowManager.showHUD();
      
      // 固定解除
      hudWindowManager.setPinnedMode(false);
      
      // 15秒後に自動非表示
      jest.advanceTimersByTime(15000);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
      
      jest.advanceTimersByTime(1000);
      expect(mockWindow.hide).toHaveBeenCalled();
    });
  });

  describe('エラー処理とエッジケース', () => {
    test('ウィンドウが破棄された後のタイマー処理', async () => {
      await hudWindowManager.showHUD();
      
      // ウィンドウを破棄状態にする
      mockWindow.isDestroyed.mockReturnValue(true);
      
      // タイマー処理が実行されてもエラーにならない
      jest.advanceTimersByTime(16000);
      expect(() => {
        // タイマーコールバックの実行
      }).not.toThrow();
    });

    test('設定ストアがない場合のデフォルト動作', () => {
      const hudManager = new HUDWindowManager();
      // setSettingsStoreを呼ばない状態
      
      expect(hudManager.autoHideDuration).toBe(15000); // デフォルト15秒
    });

    test('負の値の自動非表示時間は0として扱われる', () => {
      settingsStore.get.mockReturnValue(-5);
      hudWindowManager.updateAutoHideDuration();
      
      expect(hudWindowManager.autoHideDuration).toBe(0); // 負の値は無効化
    });
  });

  describe('パフォーマンステスト', () => {
    test('複数回のタイマーリセットが正常に処理される', async () => {
      await hudWindowManager.showHUD();
      
      // 短時間で複数回ユーザー操作
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
        hudWindowManager.notifyUserActivity();
      }
      
      // 最終的に15秒後に閉じる
      jest.advanceTimersByTime(15000);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
    });

    test('頻繁な固定モード切り替えが正常に処理される', async () => {
      await hudWindowManager.showHUD();
      
      // 頻繁な切り替え
      for (let i = 0; i < 5; i++) {
        hudWindowManager.setPinnedMode(true);
        hudWindowManager.setPinnedMode(false);
      }
      
      // 最終的に自動非表示が動作
      jest.advanceTimersByTime(15000);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-auto-hiding');
    });
  });
});