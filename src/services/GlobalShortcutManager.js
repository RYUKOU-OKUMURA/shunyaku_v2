const { globalShortcut } = require('electron');

/**
 * GlobalShortcutManager
 *
 * グローバルショートカット機能を管理するクラス
 * ショートカットの登録・解除、競合検出、設定の保存を行います
 */
class GlobalShortcutManager {
  constructor() {
    this.settingsStore = null;
    this.registeredShortcuts = new Map();
    this.defaultShortcuts = {
      capture: 'CommandOrControl+Shift+T',
      showSettings: 'CommandOrControl+Comma',
    };

    // macOS固有のショートカット表記
    this.macOSKeyMap = {
      CommandOrControl: '⌘',
      Shift: '⇧',
      Alt: '⌥',
      Control: '⌃',
      Meta: '⌘',
      Cmd: '⌘',
    };
  }

  /**
   * 初期化
   * SettingsStoreのインスタンスを受け取り、保存されたショートカットを復元
   *
   * @param {SettingsStore} settingsStore - 設定管理インスタンス
   */
  async initialize(settingsStore) {
    try {
      this.settingsStore = settingsStore;

      // 保存されたショートカット設定を読み込み
      const savedShortcuts = this.settingsStore.get('shortcuts', {});

      // デフォルト値とマージ
      const shortcuts = {
        ...this.defaultShortcuts,
        ...savedShortcuts,
      };

      // 各ショートカットを登録
      for (const [action, accelerator] of Object.entries(shortcuts)) {
        await this.registerShortcut(action, accelerator);
      }

      console.log('GlobalShortcutManager initialized with shortcuts:', shortcuts);
    } catch (error) {
      console.error('Failed to initialize GlobalShortcutManager:', error);
      throw error;
    }
  }

  /**
   * ショートカットを登録
   *
   * @param {string} action - アクション名（capture, showSettings等）
   * @param {string} accelerator - ショートカットキー（CommandOrControl+Shift+T等）
   * @param {Function} callback - ショートカット実行時のコールバック関数
   * @returns {Promise<boolean>} - 登録成功可否
   */
  async registerShortcut(action, accelerator, callback = null) {
    try {
      // 既存のショートカットを解除
      if (this.registeredShortcuts.has(action)) {
        const existingAccelerator = this.registeredShortcuts.get(action);
        globalShortcut.unregister(existingAccelerator);
        console.log(`Unregistered existing shortcut for ${action}: ${existingAccelerator}`);
      }

      // 競合チェック
      if (globalShortcut.isRegistered(accelerator)) {
        console.warn(`Shortcut ${accelerator} is already registered by another application`);
        return false;
      }

      // デフォルトコールバックまたは指定されたコールバックを使用
      const finalCallback = callback || this.getDefaultCallback(action);

      if (!finalCallback) {
        console.warn(`No callback defined for action: ${action}`);
        return false;
      }

      // ショートカットを登録
      const success = globalShortcut.register(accelerator, finalCallback);

      if (success) {
        this.registeredShortcuts.set(action, accelerator);

        // 設定を保存
        const currentShortcuts = this.settingsStore.get('shortcuts', {});
        currentShortcuts[action] = accelerator;
        this.settingsStore.set('shortcuts', currentShortcuts);

        console.log(`Successfully registered shortcut for ${action}: ${accelerator}`);
        return true;
      } else {
        console.error(`Failed to register shortcut for ${action}: ${accelerator}`);
        return false;
      }
    } catch (error) {
      console.error(`Error registering shortcut for ${action}:`, error);
      return false;
    }
  }

  /**
   * ショートカットを解除
   *
   * @param {string} action - アクション名
   * @returns {boolean} - 解除成功可否
   */
  unregisterShortcut(action) {
    try {
      if (!this.registeredShortcuts.has(action)) {
        console.warn(`No shortcut registered for action: ${action}`);
        return false;
      }

      const accelerator = this.registeredShortcuts.get(action);
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(action);

      // 設定から削除
      const currentShortcuts = this.settingsStore.get('shortcuts', {});
      delete currentShortcuts[action];
      this.settingsStore.set('shortcuts', currentShortcuts);

      console.log(`Successfully unregistered shortcut for ${action}: ${accelerator}`);
      return true;
    } catch (error) {
      console.error(`Error unregistering shortcut for ${action}:`, error);
      return false;
    }
  }

  /**
   * 全てのショートカットを解除
   */
  unregisterAll() {
    try {
      globalShortcut.unregisterAll();
      this.registeredShortcuts.clear();
      console.log('All shortcuts unregistered');
    } catch (error) {
      console.error('Error unregistering all shortcuts:', error);
    }
  }

  /**
   * 現在登録されているショートカットを取得
   *
   * @returns {Object} - アクション名とショートカットキーのマッピング
   */
  getRegisteredShortcuts() {
    const shortcuts = {};
    for (const [action, accelerator] of this.registeredShortcuts) {
      shortcuts[action] = accelerator;
    }
    return shortcuts;
  }

  /**
   * ショートカットキーの競合をチェック
   *
   * @param {string} accelerator - チェックするショートカットキー
   * @returns {boolean} - 競合している場合true
   */
  isShortcutConflicting(accelerator) {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * ショートカットキーをmacOS形式で表示用に変換
   *
   * @param {string} accelerator - ショートカットキー
   * @returns {string} - macOS形式のショートカットキー
   */
  formatShortcutForDisplay(accelerator) {
    let formatted = accelerator;

    // macOS用の記号に変換
    Object.entries(this.macOSKeyMap).forEach(([key, symbol]) => {
      formatted = formatted.replace(new RegExp(key, 'gi'), symbol);
    });

    return formatted;
  }

  /**
   * アクション用のデフォルトコールバック関数を取得
   *
   * @param {string} action - アクション名
   * @returns {Function|null} - コールバック関数
   */
  getDefaultCallback(action) {
    const callbacks = {
      capture: () => {
        console.log('Capture shortcut triggered');
        // メインプロセスに通知（実際の実装では適切なイベント発火）
        if (global.mainApp && global.mainApp.triggerCapture) {
          global.mainApp.triggerCapture();
        }
      },
      showSettings: () => {
        console.log('Settings shortcut triggered');
        // 設定画面を表示（実際の実装では適切なイベント発火）
        if (global.mainApp && global.mainApp.showSettings) {
          global.mainApp.showSettings();
        }
      },
    };

    return callbacks[action] || null;
  }

  /**
   * ショートカットキーが有効かどうかをチェック
   *
   * @param {string} accelerator - チェックするショートカットキー
   * @returns {boolean} - 有効な場合true
   */
  isValidShortcut(accelerator) {
    try {
      // 空の関数で一時的に登録してみることで有効性をチェック
      const testCallback = () => {};
      const isValid = globalShortcut.register(accelerator, testCallback);

      if (isValid) {
        globalShortcut.unregister(accelerator);
      }

      return isValid;
    } catch (error) {
      console.error('Error validating shortcut:', error);
      return false;
    }
  }

  /**
   * デフォルトショートカットを復元
   */
  async restoreDefaults() {
    try {
      // 現在のショートカットを全て解除
      this.unregisterAll();

      // デフォルトショートカットを登録
      for (const [action, accelerator] of Object.entries(this.defaultShortcuts)) {
        await this.registerShortcut(action, accelerator);
      }

      console.log('Restored default shortcuts');
      return true;
    } catch (error) {
      console.error('Error restoring default shortcuts:', error);
      return false;
    }
  }

  /**
   * ショートカット設定をエクスポート
   *
   * @returns {Object} - ショートカット設定
   */
  exportSettings() {
    return {
      shortcuts: this.getRegisteredShortcuts(),
      defaults: { ...this.defaultShortcuts },
    };
  }

  /**
   * ショートカット設定をインポート
   *
   * @param {Object} settings - インポートする設定
   * @returns {Promise<boolean>} - インポート成功可否
   */
  async importSettings(settings) {
    try {
      if (!settings || !settings.shortcuts) {
        console.warn('Invalid settings format for import');
        return false;
      }

      // 現在のショートカットを解除
      this.unregisterAll();

      // 新しいショートカットを登録
      for (const [action, accelerator] of Object.entries(settings.shortcuts)) {
        await this.registerShortcut(action, accelerator);
      }

      console.log('Successfully imported shortcut settings');
      return true;
    } catch (error) {
      console.error('Error importing shortcut settings:', error);
      return false;
    }
  }

  /**
   * クリーンアップ処理
   * アプリ終了時に呼び出される
   */
  cleanup() {
    try {
      this.unregisterAll();
      console.log('GlobalShortcutManager cleaned up');
    } catch (error) {
      console.error('Error during GlobalShortcutManager cleanup:', error);
    }
  }
}

module.exports = GlobalShortcutManager;
