const { globalShortcut, BrowserWindow, dialog } = require('electron');

/**
 * GlobalShortcutManager - グローバルショートカット管理サービス
 *
 * ElectronのglobalShortcutモジュールを使用して、
 * アプリケーション全体でのキーボードショートカットを管理します。
 *
 * 機能：
 * - ショートカット登録・解除
 * - 競合検出と警告表示
 * - 設定変更時の動的更新
 *
 * @class GlobalShortcutManager
 */
class GlobalShortcutManager {
  constructor() {
    this.registeredShortcuts = new Map();
    this.isInitialized = false;
    this.callbacks = new Map();
    this.conflictHandlers = new Map();

    // デフォルトのショートカット定義
    this.defaultShortcuts = {
      translate: {
        accelerator: 'CommandOrControl+Shift+T',
        description: 'Start translation workflow (capture → OCR → translate → HUD)',
        category: 'main',
      },
      showSettings: {
        accelerator: 'CommandOrControl+Comma',
        description: 'Open settings window',
        category: 'ui',
      },
      toggleHUD: {
        accelerator: 'CommandOrControl+Shift+H',
        description: 'Toggle HUD visibility',
        category: 'ui',
      },
    };

    console.log('🎯 GlobalShortcutManager initialized');
  }

  /**
   * ショートカットマネージャーを初期化
   * 設定に基づいてショートカットを登録
   *
   * @param {Object} settingsStore - 設定ストアインスタンス
   * @param {Object} callbacks - ショートカット別コールバック関数マップ
   * @returns {Promise<boolean>} 初期化成功可否
   */
  async initialize(settingsStore, callbacks = {}) {
    try {
      if (this.isInitialized) {
        console.log('⚠️ GlobalShortcutManager already initialized');
        return true;
      }

      this.settingsStore = settingsStore;
      this.callbacks = new Map(Object.entries(callbacks));

      // 現在のショートカット設定を取得
      const shortcutSettings = this.settingsStore.getShortcutSettings();

      // 各ショートカットを登録
      for (const [shortcutKey, accelerator] of Object.entries(shortcutSettings)) {
        if (this.defaultShortcuts[shortcutKey]) {
          const success = await this.registerShortcut(
            shortcutKey,
            accelerator,
            this.callbacks.get(shortcutKey),
          );

          if (!success) {
            console.warn(`⚠️ Failed to register shortcut: ${shortcutKey} (${accelerator})`);
          }
        }
      }

      this.isInitialized = true;
      console.log('✅ GlobalShortcutManager initialization completed');

      return true;
    } catch (error) {
      console.error('❌ GlobalShortcutManager initialization failed:', error);
      return false;
    }
  }

  /**
   * 単一ショートカットを登録
   *
   * @param {string} shortcutKey - ショートカット識別子（例: 'translate'）
   * @param {string} accelerator - ショートカットキー（例: 'CommandOrControl+Shift+T'）
   * @param {Function} callback - 実行するコールバック関数
   * @returns {Promise<boolean>} 登録成功可否
   */
  async registerShortcut(shortcutKey, accelerator, callback) {
    try {
      // 既存のショートカットを先に解除
      if (this.registeredShortcuts.has(shortcutKey)) {
        await this.unregisterShortcut(shortcutKey);
      }

      // acceleratorの検証
      if (!this.validateAccelerator(accelerator)) {
        throw new Error(`Invalid accelerator format: ${accelerator}`);
      }

      // 競合チェック
      const conflictInfo = this.checkConflicts(accelerator);
      if (conflictInfo.hasConflict) {
        // 競合がある場合は警告表示
        const shouldContinue = await this.handleConflict(conflictInfo, shortcutKey, accelerator);
        if (!shouldContinue) {
          return false;
        }
      }

      // グローバルショートカットの登録
      const registerSuccess = globalShortcut.register(accelerator, () => {
        try {
          console.log(`🎯 Global shortcut triggered: ${shortcutKey} (${accelerator})`);

          if (callback && typeof callback === 'function') {
            callback(shortcutKey, accelerator);
          } else {
            console.warn(`⚠️ No callback defined for shortcut: ${shortcutKey}`);
          }
        } catch (callbackError) {
          console.error(`❌ Shortcut callback error for ${shortcutKey}:`, callbackError);
        }
      });

      if (registerSuccess) {
        // 成功した場合の記録
        this.registeredShortcuts.set(shortcutKey, {
          accelerator: accelerator,
          callback: callback,
          registeredAt: new Date().toISOString(),
          description: this.defaultShortcuts[shortcutKey]?.description || 'User defined shortcut',
        });

        console.log(`✅ Registered global shortcut: ${shortcutKey} (${accelerator})`);
        return true;
      } else {
        throw new Error(`Failed to register global shortcut: ${accelerator}`);
      }
    } catch (error) {
      console.error(`❌ Failed to register shortcut ${shortcutKey}:`, error);
      return false;
    }
  }

  /**
   * ショートカットの登録を解除
   *
   * @param {string} shortcutKey - ショートカット識別子
   * @returns {Promise<boolean>} 解除成功可否
   */
  async unregisterShortcut(shortcutKey) {
    try {
      const shortcutInfo = this.registeredShortcuts.get(shortcutKey);

      if (!shortcutInfo) {
        console.log(`⚠️ Shortcut not registered: ${shortcutKey}`);
        return true;
      }

      // グローバルショートカットの解除
      globalShortcut.unregister(shortcutInfo.accelerator);

      // 記録から削除
      this.registeredShortcuts.delete(shortcutKey);

      console.log(`✅ Unregistered global shortcut: ${shortcutKey} (${shortcutInfo.accelerator})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to unregister shortcut ${shortcutKey}:`, error);
      return false;
    }
  }

  /**
   * 全ショートカットの登録を解除
   *
   * @returns {Promise<void>}
   */
  async unregisterAll() {
    try {
      // 個別に解除
      const shortcutKeys = Array.from(this.registeredShortcuts.keys());

      for (const shortcutKey of shortcutKeys) {
        await this.unregisterShortcut(shortcutKey);
      }

      // Electronの全ショートカット解除（念のため）
      globalShortcut.unregisterAll();

      console.log('✅ All global shortcuts unregistered');
    } catch (error) {
      console.error('❌ Failed to unregister all shortcuts:', error);
    }
  }

  /**
   * ショートカット設定の更新
   * 設定変更時に呼び出される
   *
   * @param {Object} newShortcutSettings - 新しいショートカット設定
   * @returns {Promise<boolean>} 更新成功可否
   */
  async updateShortcuts(newShortcutSettings) {
    try {
      console.log('🔄 Updating global shortcuts...');

      // 既存のショートカットを全て解除
      await this.unregisterAll();

      // 新しい設定で再登録
      for (const [shortcutKey, accelerator] of Object.entries(newShortcutSettings)) {
        if (this.defaultShortcuts[shortcutKey]) {
          const callback = this.callbacks.get(shortcutKey);

          const success = await this.registerShortcut(shortcutKey, accelerator, callback);

          if (!success) {
            console.warn(`⚠️ Failed to update shortcut: ${shortcutKey} (${accelerator})`);
          }
        }
      }

      console.log('✅ Global shortcuts updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to update shortcuts:', error);
      return false;
    }
  }

  /**
   * acceleratorの形式を検証
   *
   * @param {string} accelerator - 検証するアクセレレーター
   * @returns {boolean} 有効かどうか
   */
  validateAccelerator(accelerator) {
    if (!accelerator || typeof accelerator !== 'string') {
      return false;
    }

    // 基本的な形式チェック
    const validModifiers = [
      'CommandOrControl',
      'Command',
      'Ctrl',
      'Control',
      'Alt',
      'Option',
      'Shift',
      'Super',
    ];
    const validKeys =
      /^[A-Z0-9]$|^F[1-9]$|^F1[0-2]$|^(Space|Tab|Escape|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Comma|Period|Semicolon|Quote|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Slash)$/;

    const parts = accelerator.split('+');

    if (parts.length < 2) {
      return false;
    }

    // 最後の部分がキー、それ以外はモディファイア
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // キーの検証
    if (!validKeys.test(key)) {
      return false;
    }

    // モディファイアの検証
    for (const modifier of modifiers) {
      if (!validModifiers.includes(modifier)) {
        return false;
      }
    }

    return true;
  }

  /**
   * ショートカットの競合をチェック
   *
   * @param {string} accelerator - チェックするアクセレレーター
   * @returns {Object} 競合情報
   */
  checkConflicts(accelerator) {
    // 既に登録されているショートカットとの競合をチェック
    for (const [existingKey, existingInfo] of this.registeredShortcuts) {
      if (existingInfo.accelerator === accelerator) {
        return {
          hasConflict: true,
          type: 'internal',
          conflictWith: existingKey,
          description: existingInfo.description,
        };
      }
    }

    // システムショートカットとの既知の競合をチェック
    const knownSystemShortcuts = [
      'CommandOrControl+C',
      'CommandOrControl+V',
      'CommandOrControl+X',
      'CommandOrControl+Z',
      'CommandOrControl+A',
      'CommandOrControl+S',
      'CommandOrControl+O',
      'CommandOrControl+N',
      'CommandOrControl+Q',
      'CommandOrControl+W',
      'CommandOrControl+Tab',
      'Alt+Tab',
    ];

    if (knownSystemShortcuts.includes(accelerator)) {
      return {
        hasConflict: true,
        type: 'system',
        conflictWith: 'System shortcut',
        description: 'This shortcut is commonly used by the system',
      };
    }

    return {
      hasConflict: false,
    };
  }

  /**
   * ショートカット競合の処理
   *
   * @param {Object} conflictInfo - 競合情報
   * @param {string} shortcutKey - ショートカット識別子
   * @param {string} accelerator - アクセレレーター
   * @returns {Promise<boolean>} 続行するかどうか
   */
  async handleConflict(conflictInfo, shortcutKey, accelerator) {
    try {
      let message = '';
      let detail = '';

      if (conflictInfo.type === 'internal') {
        message = 'Shortcut Conflict Detected';
        detail = `The shortcut "${accelerator}" is already registered for "${conflictInfo.conflictWith}". Do you want to reassign it to "${shortcutKey}"?`;
      } else if (conflictInfo.type === 'system') {
        message = 'System Shortcut Warning';
        detail = `The shortcut "${accelerator}" might conflict with system shortcuts. Are you sure you want to use it?`;
      }

      const focusedWindow = BrowserWindow.getFocusedWindow();

      const response = await dialog.showMessageBox(focusedWindow, {
        type: 'warning',
        title: 'Shunyaku v2 - Shortcut Conflict',
        message: message,
        detail: detail,
        buttons: ['Continue', 'Cancel'],
        defaultId: 1, // Cancel
        cancelId: 1,
      });

      const shouldContinue = response.response === 0;

      // 内部競合の場合、既存のショートカットを解除
      if (shouldContinue && conflictInfo.type === 'internal') {
        await this.unregisterShortcut(conflictInfo.conflictWith);
      }

      return shouldContinue;
    } catch (error) {
      console.error('❌ Error handling shortcut conflict:', error);
      return false;
    }
  }

  /**
   * 現在登録されているショートカットの情報を取得
   *
   * @returns {Object} ショートカット情報
   */
  getRegisteredShortcuts() {
    const shortcuts = {};

    for (const [key, info] of this.registeredShortcuts) {
      shortcuts[key] = {
        accelerator: info.accelerator,
        description: info.description,
        registeredAt: info.registeredAt,
      };
    }

    return shortcuts;
  }

  /**
   * 利用可能なショートカットテンプレートを取得
   *
   * @returns {Object} ショートカットテンプレート
   */
  getAvailableShortcuts() {
    return { ...this.defaultShortcuts };
  }

  /**
   * ショートカットが登録されているかチェック
   *
   * @param {string} shortcutKey - ショートカット識別子
   * @returns {boolean} 登録されているかどうか
   */
  isShortcutRegistered(shortcutKey) {
    return this.registeredShortcuts.has(shortcutKey);
  }

  /**
   * 特定のアクセレレーターが利用可能かチェック
   *
   * @param {string} accelerator - チェックするアクセレレーター
   * @returns {boolean} 利用可能かどうか
   */
  isAcceleratorAvailable(accelerator) {
    return !globalShortcut.isRegistered(accelerator);
  }

  /**
   * サービスの終了処理
   * アプリ終了時に呼び出される
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down GlobalShortcutManager...');

      await this.unregisterAll();

      this.callbacks.clear();
      this.registeredShortcuts.clear();
      this.conflictHandlers.clear();
      this.isInitialized = false;

      console.log('✅ GlobalShortcutManager shutdown completed');
    } catch (error) {
      console.error('❌ Error during GlobalShortcutManager shutdown:', error);
    }
  }

  /**
   * デバッグ情報を取得
   *
   * @returns {Object} デバッグ情報
   */
  getDebugInfo() {
    return {
      isInitialized: this.isInitialized,
      registeredCount: this.registeredShortcuts.size,
      registeredShortcuts: this.getRegisteredShortcuts(),
      callbackCount: this.callbacks.size,
      electronGlobalShortcuts: globalShortcut.isRegistered ? 'Available' : 'Not Available',
    };
  }
}

module.exports = GlobalShortcutManager;
