/**
 * AppLifecycleManager テストスイート
 *
 * macOS権限管理とアプリケーションライフサイクル管理のテスト
 *
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const AppLifecycleManager = require('../src/services/AppLifecycleManager');

// Electronモジュールのモック
jest.mock('electron', () => ({
  app: {
    getName: jest.fn(() => 'Shunyaku'),
    relaunch: jest.fn(),
    exit: jest.fn(),
    quit: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
  systemPreferences: {
    getMediaAccessStatus: jest.fn(),
  },
}));

// osモジュールのモック
jest.mock('os', () => ({
  release: jest.fn(() => '22.0.0'), // macOS 13.0 Ventura
}));

describe('AppLifecycleManager', () => {
  let appLifecycleManager;
  let mockElectron;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    mockElectron = require('electron');
    
    // デフォルトのモック設定
    mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    mockElectron.dialog.showMessageBox.mockResolvedValue({ response: 1 }); // あとで設定する
    mockElectron.shell.openExternal.mockResolvedValue();

    // platformをmacOSに設定
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
    });

    appLifecycleManager = new AppLifecycleManager();
  });

  afterEach(() => {
    if (appLifecycleManager) {
      appLifecycleManager.destroy();
    }
  });

  describe('constructor', () => {
    test('デフォルト値で初期化できる', () => {
      expect(appLifecycleManager.screenRecordingPermission).toBeNull();
      expect(appLifecycleManager.isCheckingPermissions).toBe(false);
      expect(appLifecycleManager.isWaitingForRestart).toBe(false);
      expect(appLifecycleManager.retryConfig).toEqual({
        maxRetries: 3,
        currentRetries: 0,
        retryDelay: 2000,
      });
    });
  });

  describe('checkScreenRecordingPermission', () => {
    test('macOSで権限が許可されている場合、trueを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('granted');

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(true);
      expect(appLifecycleManager.screenRecordingPermission).toBe(true);
      expect(mockElectron.systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('screen');
    });

    test('macOSで権限が拒否されている場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('denied');

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(false);
      expect(appLifecycleManager.screenRecordingPermission).toBe(false);
    });

    test('macOSで権限が制限されている場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('restricted');

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(false);
      expect(appLifecycleManager.screenRecordingPermission).toBe(false);
    });

    test('macOSで権限が未決定の場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('not-determined');

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(false);
      expect(appLifecycleManager.screenRecordingPermission).toBe(false);
    });

    test('macOS以外のプラットフォームでは常にtrueを返す', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(true);
      expect(appLifecycleManager.screenRecordingPermission).toBe(true);
      expect(mockElectron.systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled();
    });

    test('エラーが発生した場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(false);
      expect(appLifecycleManager.screenRecordingPermission).toBe(false);
    });

    test('チェック実行中に重複呼び出しされた場合、既存の結果を返す', async () => {
      // 最初のチェックを実行中状態に設定
      appLifecycleManager.isCheckingPermissions = true;
      appLifecycleManager.screenRecordingPermission = true;

      const result = await appLifecycleManager.checkScreenRecordingPermission();

      expect(result).toBe(true);
      expect(mockElectron.systemPreferences.getMediaAccessStatus).not.toHaveBeenCalled();
    });
  });

  describe('checkAllPermissions', () => {
    test('Screen Recording権限が許可されている場合、trueを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('granted');

      const result = await appLifecycleManager.checkAllPermissions();

      expect(result).toBe(true);
    });

    test('Screen Recording権限が拒否されている場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('denied');

      const result = await appLifecycleManager.checkAllPermissions();

      expect(result).toBe(false);
    });

    test('エラーが発生した場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await appLifecycleManager.checkAllPermissions();

      expect(result).toBe(false);
    });
  });

  describe('initialize', () => {
    test('macOSで権限がある場合、初期化が成功する', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('granted');

      const result = await appLifecycleManager.initialize();

      expect(result).toBe(true);
    });

    test('macOSで権限がない場合、ガイドを表示してfalseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('denied');
      mockElectron.dialog.showMessageBox.mockResolvedValue({ response: 1 }); // あとで設定する

      const result = await appLifecycleManager.initialize();

      expect(result).toBe(false);
      expect(mockElectron.dialog.showMessageBox).toHaveBeenCalled();
    });

    test('macOS以外のプラットフォームでは常に成功する', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const result = await appLifecycleManager.initialize();

      expect(result).toBe(true);
    });

    test('初期化中にエラーが発生した場合、falseを返す', async () => {
      mockElectron.systemPreferences.getMediaAccessStatus.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await appLifecycleManager.initialize();

      expect(result).toBe(false);
    });
  });

  describe('showPermissionGuide', () => {
    test('システム環境設定を開くを選択した場合、設定を開く', async () => {
      mockElectron.dialog.showMessageBox.mockResolvedValue({ response: 0 }); // システム環境設定を開く

      await appLifecycleManager.showPermissionGuide();

      expect(mockElectron.dialog.showMessageBox).toHaveBeenCalled();
      expect(mockElectron.shell.openExternal).toHaveBeenCalled();
    });

    test('アプリを終了を選択した場合、アプリを終了する', async () => {
      mockElectron.dialog.showMessageBox.mockResolvedValue({ response: 2 }); // アプリを終了

      await appLifecycleManager.showPermissionGuide();

      expect(mockElectron.dialog.showMessageBox).toHaveBeenCalled();
      expect(mockElectron.app.quit).toHaveBeenCalled();
    });

    test('あとで設定するを選択した場合、何もしない', async () => {
      mockElectron.dialog.showMessageBox.mockResolvedValue({ response: 1 }); // あとで設定する

      await appLifecycleManager.showPermissionGuide();

      expect(mockElectron.dialog.showMessageBox).toHaveBeenCalled();
      expect(mockElectron.shell.openExternal).not.toHaveBeenCalled();
      expect(mockElectron.app.quit).not.toHaveBeenCalled();
    });
  });

  describe('openSystemPreferences', () => {
    test('macOS Ventura以降では新しいシステム設定URLを開く', async () => {
      // macOS 13.0 Ventura (kernel version 22.x)
      require('os').release.mockReturnValue('22.0.0');

      await appLifecycleManager.openSystemPreferences();

      expect(mockElectron.shell.openExternal).toHaveBeenCalledWith(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
    });

    test('エラーが発生した場合、フォールバック設定を試行する', async () => {
      mockElectron.shell.openExternal
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce();

      await appLifecycleManager.openSystemPreferences();

      expect(mockElectron.shell.openExternal).toHaveBeenCalledTimes(2);
      expect(mockElectron.shell.openExternal).toHaveBeenLastCalledWith('x-apple.systempreferences:');
    });
  });

  describe('restartApp', () => {
    test('アプリを再起動する', async () => {
      await appLifecycleManager.restartApp();

      expect(mockElectron.app.relaunch).toHaveBeenCalled();
      expect(mockElectron.app.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('getPermissionStatus', () => {
    test('権限状態オブジェクトを返す', () => {
      appLifecycleManager.screenRecordingPermission = true;
      appLifecycleManager.isCheckingPermissions = false;
      appLifecycleManager.isWaitingForRestart = false;

      const status = appLifecycleManager.getPermissionStatus();

      expect(status).toEqual({
        screenRecording: true,
        isCheckingPermissions: false,
        isWaitingForRestart: false,
      });
    });
  });

  describe('recheckPermissions', () => {
    test('権限を再チェックする', async () => {
      // 初期状態を設定
      appLifecycleManager.screenRecordingPermission = false;
      mockElectron.systemPreferences.getMediaAccessStatus.mockReturnValue('granted');

      const result = await appLifecycleManager.recheckPermissions();

      expect(result).toBe(true);
      expect(appLifecycleManager.screenRecordingPermission).toBe(true);
    });
  });

  describe('destroy', () => {
    test('リソースをクリーンアップする', () => {
      appLifecycleManager.isCheckingPermissions = true;
      appLifecycleManager.isWaitingForRestart = true;
      appLifecycleManager.retryConfig.currentRetries = 2;

      appLifecycleManager.destroy();

      expect(appLifecycleManager.isCheckingPermissions).toBe(false);
      expect(appLifecycleManager.isWaitingForRestart).toBe(false);
      expect(appLifecycleManager.retryConfig.currentRetries).toBe(0);
    });
  });
});