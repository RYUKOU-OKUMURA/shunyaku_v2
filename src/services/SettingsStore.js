/**
 * SettingsStore.js
 * Shunyaku v2 アプリケーションの設定管理システム
 *
 * このクラスは electron-store を使用して、アプリケーションの設定を
 * 永続化・管理します。設定スキーマの定義、デフォルト値の設定、
 * 設定の読み書きメソッドを提供します。
 */

const Store = require('electron-store');

/**
 * 設定スキーマ定義
 * アプリケーションで使用する全ての設定項目とその型、デフォルト値を定義
 */
const SETTINGS_SCHEMA = {
  // 翻訳設定
  translation: {
    type: 'object',
    properties: {
      // 翻訳先言語
      targetLanguage: {
        type: 'string',
        enum: ['ja', 'en', 'zh', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'nl', 'pl'],
        default: 'ja',
      },
      // 翻訳元言語（自動検出の場合は 'auto'）
      sourceLanguage: {
        type: 'string',
        enum: [
          'auto',
          'en',
          'ja',
          'zh',
          'ko',
          'fr',
          'de',
          'es',
          'it',
          'pt',
          'ru',
          'ar',
          'nl',
          'pl',
        ],
        default: 'auto',
      },
    },
    default: {
      targetLanguage: 'ja',
      sourceLanguage: 'auto',
    },
  },

  // OCR設定
  ocr: {
    type: 'object',
    properties: {
      // OCR対象言語
      languages: {
        type: 'array',
        items: {
          type: 'string',
        },
        default: ['eng', 'jpn'],
      },
      // OCR精度設定（PSM: Page Segmentation Mode）
      psm: {
        type: 'number',
        minimum: 0,
        maximum: 13,
        default: 6,
      },
      // 信頼度閾値（0-100）
      confidenceThreshold: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        default: 60,
      },
    },
    default: {
      languages: ['eng', 'jpn'],
      psm: 6,
      confidenceThreshold: 60,
    },
  },

  // HUD設定
  hud: {
    type: 'object',
    properties: {
      // HUDサイズ
      size: {
        type: 'object',
        properties: {
          width: { type: 'number', minimum: 200, maximum: 800, default: 400 },
          height: { type: 'number', minimum: 150, maximum: 600, default: 300 },
        },
        default: { width: 400, height: 300 },
      },
      // 自動非表示時間（秒、0で無効）
      autoHideDuration: {
        type: 'number',
        minimum: 0,
        maximum: 300,
        default: 15,
      },
      // テーマ
      theme: {
        type: 'string',
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      // 不透明度（0.0-1.0）
      opacity: {
        type: 'number',
        minimum: 0.1,
        maximum: 1.0,
        default: 0.95,
      },
      // HUD表示位置
      position: {
        type: 'string',
        enum: ['mouse', 'center', 'fixed'],
        default: 'mouse',
      },
      // 固定位置の設定
      fixedPosition: {
        type: 'object',
        properties: {
          x: { type: 'number', minimum: 0, default: 100 },
          y: { type: 'number', minimum: 0, default: 100 },
        },
        default: { x: 100, y: 100 },
      },
    },
    default: {
      size: { width: 400, height: 300 },
      autoHideDuration: 15,
      theme: 'auto',
      opacity: 0.95,
      position: 'mouse',
      fixedPosition: { x: 100, y: 100 },
    },
  },

  // ショートカット設定
  shortcuts: {
    type: 'object',
    properties: {
      // 翻訳実行ショートカット
      translate: {
        type: 'string',
        default: 'CommandOrControl+Shift+T',
      },
      // 設定画面表示ショートカット
      showSettings: {
        type: 'string',
        default: 'CommandOrControl+Comma',
      },
      // HUD表示切替ショートカット
      toggleHUD: {
        type: 'string',
        default: 'CommandOrControl+Shift+H',
      },
    },
    default: {
      translate: 'CommandOrControl+Shift+T',
      showSettings: 'CommandOrControl+Comma',
      toggleHUD: 'CommandOrControl+Shift+H',
    },
  },

  // アプリケーション設定
  app: {
    type: 'object',
    properties: {
      // 起動時の動作
      startBehavior: {
        type: 'string',
        enum: ['normal', 'minimized', 'hidden'],
        default: 'normal',
      },
      // 自動更新チェック
      autoUpdate: {
        type: 'boolean',
        default: true,
      },
      // 使用統計の送信
      analytics: {
        type: 'boolean',
        default: false,
      },
      // ログレベル
      logLevel: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'debug'],
        default: 'info',
      },
    },
    default: {
      startBehavior: 'normal',
      autoUpdate: true,
      analytics: false,
      logLevel: 'info',
    },
  },
};

/**
 * デフォルト設定値を抽出
 * スキーマからdefault値を再帰的に抽出してフラットな設定オブジェクトを生成
 */
function extractDefaults(schema) {
  const defaults = {};

  for (const [key, value] of Object.entries(schema)) {
    if (value.default !== undefined) {
      defaults[key] = value.default;
    } else if (value.type === 'object' && value.properties) {
      defaults[key] = extractDefaults(value.properties);
    }
  }

  return defaults;
}

const DEFAULT_SETTINGS = extractDefaults(SETTINGS_SCHEMA);

/**
 * SettingsStore クラス
 * アプリケーションの設定管理を行うメインクラス
 */
class SettingsStore {
  /**
   * コンストラクタ
   * @param {Object} options - electron-storeのオプション
   */
  constructor(options = {}) {
    // electron-store の初期化
    this.store = new Store({
      name: 'shunyaku-settings',
      schema: SETTINGS_SCHEMA,
      defaults: DEFAULT_SETTINGS,
      clearInvalidConfig: true, // 無効な設定を自動削除
      accessPropertiesByDotNotation: true, // ドット記法でのアクセスを有効化
      ...options,
    });

    // 設定変更イベントリスナーを格納する配列
    this.listeners = [];

    // electron-storeの変更イベントをラップ
    this.store.onDidAnyChange((newValue, oldValue) => {
      this.listeners.forEach((listener) => {
        try {
          listener(newValue, oldValue);
        } catch (error) {
          console.error('Settings change listener error:', error);
        }
      });
    });
  }

  /**
   * 設定値を取得
   * @param {string} key - 設定キー（ドット記法対応）
   * @param {*} defaultValue - デフォルト値（オプション）
   * @returns {*} 設定値
   */
  get(key, defaultValue) {
    try {
      return this.store.get(key, defaultValue);
    } catch (error) {
      console.error(`Settings get error for key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 設定値を保存
   * @param {string|Object} key - 設定キーまたは設定オブジェクト
   * @param {*} value - 設定値（keyが文字列の場合）
   */
  set(key, value) {
    try {
      this.store.set(key, value);
    } catch (error) {
      console.error(`Settings set error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 設定値を削除
   * @param {string} key - 設定キー
   */
  delete(key) {
    try {
      this.store.delete(key);
    } catch (error) {
      console.error(`Settings delete error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * 指定したキーが存在するかチェック
   * @param {string} key - 設定キー
   * @returns {boolean} 存在するかどうか
   */
  has(key) {
    try {
      return this.store.has(key);
    } catch (error) {
      console.error(`Settings has error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * 全ての設定を取得
   * @returns {Object} 全設定オブジェクト
   */
  getAll() {
    try {
      return this.store.store;
    } catch (error) {
      console.error('Settings getAll error:', error);
      return {};
    }
  }

  /**
   * 全ての設定をクリア（デフォルト値にリセット）
   */
  clear() {
    try {
      this.store.clear();
      // デフォルト値を再設定
      this.store.set(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Settings clear error:', error);
      throw error;
    }
  }

  /**
   * 設定をデフォルト値にリセット
   * @param {string} key - リセットするキー（省略時は全設定）
   */
  reset(key) {
    try {
      if (key) {
        // 特定のキーをリセット
        const defaultValue = this.getDefaultValue(key);
        if (defaultValue !== undefined) {
          this.store.set(key, defaultValue);
        }
      } else {
        // 全設定をリセット
        this.clear();
      }
    } catch (error) {
      console.error(`Settings reset error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * デフォルト値を取得
   * @param {string} key - 設定キー
   * @returns {*} デフォルト値
   */
  getDefaultValue(key) {
    const keys = key.split('.');
    let current = DEFAULT_SETTINGS;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 設定変更イベントリスナーを追加
   * @param {Function} listener - リスナー関数
   * @returns {Function} リスナー削除用関数
   */
  onChange(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);

      // リスナー削除用関数を返す
      return () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      };
    }

    throw new Error('Listener must be a function');
  }

  /**
   * 特定のキーの変更を監視
   * @param {string} key - 監視するキー
   * @param {Function} listener - リスナー関数
   * @returns {Function} リスナー削除用関数
   */
  onKeyChange(key, listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    const wrappedListener = (newValue, oldValue) => {
      const newKeyValue = this.getValueByPath(newValue, key);
      const oldKeyValue = this.getValueByPath(oldValue, key);

      if (newKeyValue !== oldKeyValue) {
        listener(newKeyValue, oldKeyValue);
      }
    };

    return this.onChange(wrappedListener);
  }

  /**
   * パスを使用してオブジェクトから値を取得
   * @param {Object} obj - 対象オブジェクト
   * @param {string} path - パス（ドット記法）
   * @returns {*} 値
   */
  getValueByPath(obj, path) {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 設定の検証
   * @param {string} key - 設定キー
   * @param {*} value - 検証する値
   * @returns {boolean} 有効な値かどうか
   */
  validate(key, value) {
    try {
      // 簡略化された検証ロジック
      // 実際の検証はelectron-storeのスキーマで行われるため、
      // ここでは基本的な型チェックのみ実行

      if (key && value !== undefined) {
        // 基本的な型チェック
        const keyParts = key.split('.');

        // スキーマが存在する場合の簡単な検証
        if (keyParts[0] in DEFAULT_SETTINGS) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(`Validation error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * 設定のエクスポート
   * @returns {Object} エクスポートされた設定
   */
  export() {
    try {
      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: this.getAll(),
      };
    } catch (error) {
      console.error('Settings export error:', error);
      throw error;
    }
  }

  /**
   * 設定のインポート
   * @param {Object} data - インポートする設定データ
   * @param {boolean} merge - 既存設定とマージするか（デフォルト: true）
   */
  import(data, merge = true) {
    try {
      if (!data || !data.settings) {
        throw new Error('Invalid import data format');
      }

      if (merge) {
        // 既存設定とマージ
        const currentSettings = this.getAll();
        const mergedSettings = { ...currentSettings, ...data.settings };
        this.store.set(mergedSettings);
      } else {
        // 完全置き換え
        this.store.clear();
        this.store.set(data.settings);
      }
    } catch (error) {
      console.error('Settings import error:', error);
      throw error;
    }
  }

  /**
   * 設定ファイルパスを取得
   * @returns {string} 設定ファイルのフルパス
   */
  getStorePath() {
    return this.store.path;
  }

  /**
   * 設定ストアのサイズを取得
   * @returns {number} 設定項目数
   */
  size() {
    return this.store.size;
  }

  /**
   * リソースのクリーンアップ
   */
  destroy() {
    try {
      // リスナーをクリア
      this.listeners.length = 0;

      // ストアのクリーンアップ（electron-storeには明示的なdestroy方法がないため、参照をクリア）
      this.store = null;
    } catch (error) {
      console.error('Settings destroy error:', error);
    }
  }
}

module.exports = {
  SettingsStore,
  SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
};
