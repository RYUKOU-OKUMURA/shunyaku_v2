/**
 * AppLifecycleManager.js
 *
 * macOSでのアプリケーション起動時の権限管理とライフサイクル管理を行うクラス
 * Screen Recording権限の確認、ガイド表示、システム設定への導線を提供
 *
 * @author Shunyaku Development Team
 * @version 1.0.0
 */

const { app, dialog, shell, systemPreferences } = require('electron');

class AppLifecycleManager {
  constructor() {
    /**
     * Screen Recording権限の状態
     * @type {boolean|null} null: 未チェック, true: 許可済み, false: 未許可
     */
    this.screenRecordingPermission = null;

    /**
     * 権限チェック中フラグ
     * @type {boolean}
     */
    this.isCheckingPermissions = false;

    /**
     * アプリ再起動待機中フラグ
     * @type {boolean}
     */
    this.isWaitingForRestart = false;

    /**
     * 権限チェックのリトライ設定
     * @type {Object}
     */
    this.retryConfig = {
      maxRetries: 3,
      currentRetries: 0,
      retryDelay: 2000, // 2秒
    };
  }

  /**
   * アプリケーション起動時の初期化処理
   * @returns {Promise<boolean>} 初期化成功フラグ
   */
  async initialize() {
    try {
      console.log('AppLifecycleManager: 初期化開始');

      // macOSでない場合はスキップ
      if (process.platform !== 'darwin') {
        console.log('AppLifecycleManager: macOS以外のため権限チェックをスキップ');
        return true;
      }

      // 権限チェック実行
      const hasPermissions = await this.checkAllPermissions();

      if (!hasPermissions) {
        console.log('AppLifecycleManager: 必要な権限が不足しています');
        await this.showPermissionGuide();
        return false;
      }

      console.log('AppLifecycleManager: 初期化完了');
      return true;
    } catch (error) {
      console.error('AppLifecycleManager: 初期化エラー', error);
      return false;
    }
  }

  /**
   * Screen Recording権限の状態をチェック
   * @returns {Promise<boolean>} 権限の有無
   */
  async checkScreenRecordingPermission() {
    try {
      if (this.isCheckingPermissions) {
        console.log('AppLifecycleManager: 権限チェック実行中のためスキップ');
        return this.screenRecordingPermission || false;
      }

      this.isCheckingPermissions = true;

      // macOSの場合のみチェック
      if (process.platform !== 'darwin') {
        this.screenRecordingPermission = true;
        return true;
      }

      // Electron 27以降のAPIを使用してScreen Recording権限をチェック
      const hasPermission = systemPreferences.getMediaAccessStatus('screen');

      // 権限状態の判定
      if (hasPermission === 'granted') {
        this.screenRecordingPermission = true;
        console.log('AppLifecycleManager: Screen Recording権限が許可されています');
        return true;
      } else if (hasPermission === 'denied') {
        this.screenRecordingPermission = false;
        console.log('AppLifecycleManager: Screen Recording権限が拒否されています');
        return false;
      } else if (hasPermission === 'restricted') {
        this.screenRecordingPermission = false;
        console.log('AppLifecycleManager: Screen Recording権限が制限されています');
        return false;
      } else {
        // 'not-determined' - 権限が未決定の状態
        this.screenRecordingPermission = false;
        console.log('AppLifecycleManager: Screen Recording権限が未決定です');
        return false;
      }
    } catch (error) {
      console.error('AppLifecycleManager: Screen Recording権限チェックエラー', error);
      this.screenRecordingPermission = false;
      return false;
    } finally {
      this.isCheckingPermissions = false;
    }
  }

  /**
   * 全ての必要な権限をチェック
   * @returns {Promise<boolean>} 全権限の有無
   */
  async checkAllPermissions() {
    try {
      console.log('AppLifecycleManager: 全権限チェック開始');

      const permissions = {
        screenRecording: await this.checkScreenRecordingPermission(),
      };

      const allGranted = Object.values(permissions).every(granted => granted);

      console.log('AppLifecycleManager: 権限チェック結果', {
        screenRecording: permissions.screenRecording,
        allGranted,
      });

      return allGranted;
    } catch (error) {
      console.error('AppLifecycleManager: 権限チェックエラー', error);
      return false;
    }
  }

  /**
   * 権限未許可時のガイドダイアログを表示
   * @returns {Promise<void>}
   */
  async showPermissionGuide() {
    try {
      console.log('AppLifecycleManager: 権限ガイドダイアログ表示');

      const result = await dialog.showMessageBox(null, {
        type: 'warning',
        title: 'Shunyaku - 権限設定が必要です',
        message: 'スクリーンショット翻訳機能を使用するには、Screen Recording権限が必要です。',
        detail: [
          'このアプリは以下の機能のために権限を使用します：',
          '',
          '• Screen Recording権限:',
          '  画面の一部をキャプチャして翻訳するため',
          '',
          '「システム環境設定を開く」をクリックして、',
          '「セキュリティとプライバシー」> 「プライバシー」> 「画面収録」',
          'でShunyakuにチェックを入れてください。',
          '',
          '権限を許可した後、アプリを再起動してください。',
        ].join('\n'),
        buttons: ['システム環境設定を開く', 'あとで設定する', 'アプリを終了'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });

      switch (result.response) {
      case 0: // システム環境設定を開く
        await this.openSystemPreferences();
        await this.waitForPermissionAndRestart();
        break;
      case 1: // あとで設定する
        console.log('AppLifecycleManager: 権限設定を後回しにしました');
        break;
      case 2: // アプリを終了
        console.log('AppLifecycleManager: ユーザーがアプリ終了を選択しました');
        app.quit();
        break;
      }
    } catch (error) {
      console.error('AppLifecycleManager: 権限ガイド表示エラー', error);
    }
  }

  /**
   * システム環境設定を開く
   * @returns {Promise<void>}
   */
  async openSystemPreferences() {
    try {
      console.log('AppLifecycleManager: システム環境設定を開きます');

      // macOS Ventura (13.0) 以降では新しいシステム設定アプリ
      const osVersion = require('os').release();
      const majorVersion = parseInt(osVersion.split('.')[0]);

      let settingsUrl;
      if (majorVersion >= 22) { // macOS 13.0 Ventura以降
        settingsUrl = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
      } else {
        settingsUrl = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
      }

      await shell.openExternal(settingsUrl);
      console.log('AppLifecycleManager: システム環境設定を開きました');
    } catch (error) {
      console.error('AppLifecycleManager: システム環境設定オープンエラー', error);

      // フォールバック：一般的なシステム環境設定を開く
      try {
        await shell.openExternal('x-apple.systempreferences:');
      } catch (fallbackError) {
        console.error('AppLifecycleManager: フォールバック設定オープンエラー', fallbackError);
      }
    }
  }

  /**
   * 権限取得を待機し、取得後に自動再起動
   * @returns {Promise<void>}
   */
  async waitForPermissionAndRestart() {
    try {
      console.log('AppLifecycleManager: 権限取得待機開始');
      this.isWaitingForRestart = true;
      this.retryConfig.currentRetries = 0;

      // 権限取得を定期的にチェック
      const checkInterval = setInterval(async () => {
        try {
          const hasPermission = await this.checkScreenRecordingPermission();

          if (hasPermission) {
            console.log('AppLifecycleManager: 権限が付与されました。再起動します');
            clearInterval(checkInterval);
            this.isWaitingForRestart = false;
            await this.restartApp();
          } else {
            this.retryConfig.currentRetries++;
            console.log(`AppLifecycleManager: 権限チェック中... (${this.retryConfig.currentRetries}/${this.retryConfig.maxRetries})`);

            // 最大リトライ回数に達した場合
            if (this.retryConfig.currentRetries >= this.retryConfig.maxRetries) {
              clearInterval(checkInterval);
              this.isWaitingForRestart = false;
              await this.showRestartReminder();
            }
          }
        } catch (error) {
          console.error('AppLifecycleManager: 権限チェック中にエラー', error);
        }
      }, this.retryConfig.retryDelay);

    } catch (error) {
      console.error('AppLifecycleManager: 権限待機エラー', error);
      this.isWaitingForRestart = false;
    }
  }

  /**
   * 再起動リマインダーを表示
   * @returns {Promise<void>}
   */
  async showRestartReminder() {
    try {
      const result = await dialog.showMessageBox(null, {
        type: 'info',
        title: 'Shunyaku - 再起動が必要です',
        message: '権限設定を反映するために、アプリの再起動が必要です。',
        detail: [
          'システム環境設定で権限を許可した場合は、',
          '「今すぐ再起動」をクリックしてください。',
          '',
          '権限を許可していない場合は、',
          'システム環境設定で設定を完了してから再起動してください。',
        ].join('\n'),
        buttons: ['今すぐ再起動', 'あとで再起動'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        await this.restartApp();
      }
    } catch (error) {
      console.error('AppLifecycleManager: 再起動リマインダー表示エラー', error);
    }
  }

  /**
   * アプリケーションを再起動
   * @returns {Promise<void>}
   */
  async restartApp() {
    try {
      console.log('AppLifecycleManager: アプリケーションを再起動します');

      // 設定とウィンドウの状態を保存
      await this.saveAppState();

      // アプリを再起動
      app.relaunch();
      app.exit(0);
    } catch (error) {
      console.error('AppLifecycleManager: アプリ再起動エラー', error);
    }
  }

  /**
   * アプリケーション状態を保存
   * @returns {Promise<void>}
   */
  async saveAppState() {
    try {
      // 必要に応じて設定やウィンドウの状態を保存
      console.log('AppLifecycleManager: アプリ状態を保存しました');
    } catch (error) {
      console.error('AppLifecycleManager: アプリ状態保存エラー', error);
    }
  }

  /**
   * 権限状態の取得
   * @returns {Object} 権限状態オブジェクト
   */
  getPermissionStatus() {
    return {
      screenRecording: this.screenRecordingPermission,
      isCheckingPermissions: this.isCheckingPermissions,
      isWaitingForRestart: this.isWaitingForRestart,
    };
  }

  /**
   * 手動で権限チェックを再実行
   * @returns {Promise<boolean>} チェック結果
   */
  async recheckPermissions() {
    console.log('AppLifecycleManager: 手動権限再チェック開始');
    this.screenRecordingPermission = null;
    return await this.checkAllPermissions();
  }

  /**
   * AppLifecycleManagerのクリーンアップ
   */
  destroy() {
    try {
      this.isCheckingPermissions = false;
      this.isWaitingForRestart = false;
      this.retryConfig.currentRetries = 0;
      console.log('AppLifecycleManager: クリーンアップ完了');
    } catch (error) {
      console.error('AppLifecycleManager: クリーンアップエラー', error);
    }
  }
}

module.exports = AppLifecycleManager;
