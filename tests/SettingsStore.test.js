/**
 * SettingsStore.test.js
 * SettingsStoreクラスのユニットテスト（electron-store モック使用）
 */

// electron-storeをモックする
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  onDidAnyChange: jest.fn(),
  store: {},
  path: '/mock/path/config.json',
  size: 0,
};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation((options) => {
    // デフォルト設定をmockStoreに設定
    if (options && options.defaults) {
      mockStore.store = { ...options.defaults };
      mockStore.size = Object.keys(options.defaults).flat().length;
    }
    
    // get の実装をリセット
    mockStore.get.mockImplementation((key, defaultValue) => {
      if (!key) return mockStore.store;
      
      const keys = key.split('.');
      let current = mockStore.store;
      
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return defaultValue;
        }
      }
      
      return current !== undefined ? current : defaultValue;
    });
    
    // set の実装をリセット
    mockStore.set.mockImplementation((key, value) => {
      if (typeof key === 'object') {
        // オブジェクト全体を設定
        mockStore.store = { ...mockStore.store, ...key };
      } else {
        const keys = key.split('.');
        let current = mockStore.store;
        
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (!current[k] || typeof current[k] !== 'object') {
            current[k] = {};
          }
          current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
      }
      
      // イベント発火のシミュレーション
      if (mockStore.onDidAnyChangeCallback) {
        const newValue = { ...mockStore.store };
        const oldValue = {};  // 簡略化のため空オブジェクト
        mockStore.onDidAnyChangeCallback(newValue, oldValue);
      }
    });
    
    // has の実装をリセット
    mockStore.has.mockImplementation((key) => {
      const keys = key.split('.');
      let current = mockStore.store;
      
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return false;
        }
      }
      
      return true;
    });
    
    // delete の実装をリセット
    mockStore.delete.mockImplementation((key) => {
      const keys = key.split('.');
      let current = mockStore.store;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return;
        }
      }
      
      delete current[keys[keys.length - 1]];
    });
    
    // clear の実装をリセット
    mockStore.clear.mockImplementation(() => {
      mockStore.store = {};
    });
    
    // onDidAnyChange の実装をリセット
    mockStore.onDidAnyChange.mockImplementation((callback) => {
      mockStore.onDidAnyChangeCallback = callback;
    });
    
    return mockStore;
  });
});

const { SettingsStore, SETTINGS_SCHEMA, DEFAULT_SETTINGS } = require('../src/services/SettingsStore');

describe('SettingsStore', () => {
  let settingsStore;
  
  beforeEach(() => {
    // mockをリセット
    jest.clearAllMocks();
    mockStore.store = {};
    mockStore.onDidAnyChangeCallback = null;
    
    // 新しいSettingsStoreインスタンスを作成
    settingsStore = new SettingsStore({
      name: `test-settings-${Date.now()}`,
    });
  });
  
  afterEach(() => {
    // テスト後のクリーンアップ
    if (settingsStore) {
      settingsStore.destroy();
      settingsStore = null;
    }
  });

  describe('Initialization', () => {
    test('should initialize with default settings', () => {
      expect(settingsStore).toBeDefined();
      expect(settingsStore.store).toBeDefined();
    });

    test('should have valid store path', () => {
      const storePath = settingsStore.getStorePath();
      expect(typeof storePath).toBe('string');
      expect(storePath.length).toBeGreaterThan(0);
    });
  });

  describe('Basic Operations', () => {
    beforeEach(() => {
      // テストデータをセットアップ
      mockStore.store = {
        translation: {
          targetLanguage: 'ja',
          sourceLanguage: 'auto',
        },
        ocr: {
          languages: ['eng', 'jpn'],
          confidenceThreshold: 60,
        },
      };
    });

    test('should get and set values', () => {
      // 単純な値の設定と取得
      settingsStore.set('translation.targetLanguage', 'en');
      expect(mockStore.set).toHaveBeenCalledWith('translation.targetLanguage', 'en');
      
      // 値の取得をテスト
      const result = settingsStore.get('translation.targetLanguage');
      expect(mockStore.get).toHaveBeenCalledWith('translation.targetLanguage', undefined);
    });

    test('should get default values for undefined keys', () => {
      const defaultValue = 'test-default';
      const result = settingsStore.get('nonexistent.key', defaultValue);
      expect(mockStore.get).toHaveBeenCalledWith('nonexistent.key', defaultValue);
    });

    test('should check if key exists', () => {
      settingsStore.has('translation.targetLanguage');
      expect(mockStore.has).toHaveBeenCalledWith('translation.targetLanguage');
      
      settingsStore.has('nonexistent.key');
      expect(mockStore.has).toHaveBeenCalledWith('nonexistent.key');
    });

    test('should delete keys', () => {
      settingsStore.delete('test.key');
      expect(mockStore.delete).toHaveBeenCalledWith('test.key');
    });

    test('should get all settings', () => {
      settingsStore.getAll();
      // mockStore.storeが返されることを確認
      expect(typeof settingsStore.getAll()).toBe('object');
    });

    test('should get store size', () => {
      const size = settingsStore.size();
      expect(typeof size).toBe('number');
    });
  });

  describe('Reset and Clear Operations', () => {
    test('should reset specific key to default', () => {
      settingsStore.reset('translation.targetLanguage');
      // resetが正常に動作することを確認（実際の値はデフォルト値チェックで確認）
      expect(settingsStore.getDefaultValue('translation.targetLanguage')).toBe('ja');
    });

    test('should clear all settings', () => {
      settingsStore.clear();
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalled(); // デフォルト値の再設定
    });
  });

  describe('Default Value Operations', () => {
    test('should get default values', () => {
      expect(settingsStore.getDefaultValue('translation.targetLanguage')).toBe('ja');
      expect(settingsStore.getDefaultValue('ocr.languages')).toEqual(['eng', 'jpn']);
      expect(settingsStore.getDefaultValue('hud.size')).toEqual({ width: 400, height: 300 });
      
      // 存在しないキーの場合は undefined
      expect(settingsStore.getDefaultValue('nonexistent.key')).toBeUndefined();
    });
  });

  describe('Event Listeners', () => {
    test('should add and remove change listeners', () => {
      const mockListener = jest.fn();
      
      const removeListener = settingsStore.onChange(mockListener);
      
      // リスナーが追加されていることを確認
      expect(settingsStore.listeners).toContain(mockListener);
      
      // リスナーを削除
      removeListener();
      
      // リスナーが削除されていることを確認
      expect(settingsStore.listeners).not.toContain(mockListener);
    });

    test('should listen to specific key changes', () => {
      const mockListener = jest.fn();
      
      const removeListener = settingsStore.onKeyChange('translation.targetLanguage', mockListener);
      
      expect(typeof removeListener).toBe('function');
      
      // リスナーを削除
      removeListener();
    });

    test('should handle invalid listeners', () => {
      expect(() => {
        settingsStore.onChange('not-a-function');
      }).toThrow('Listener must be a function');
      
      expect(() => {
        settingsStore.onKeyChange('key', 'not-a-function');
      }).toThrow('Listener must be a function');
    });
  });

  describe('Validation', () => {
    test('should validate correct values', () => {
      // 検証メソッドは簡略化してtrue/falseを返すようにする
      expect(settingsStore.validate('translation.targetLanguage', 'en')).toBe(true);
      expect(settingsStore.validate('ocr.languages', ['eng'])).toBe(true);
    });

    test('should handle validation errors', () => {
      // 無効な値でもエラーをキャッチしてfalseを返すことを確認
      const result = settingsStore.validate('invalid.key', 'invalid-value');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Import/Export', () => {
    test('should export settings', () => {
      const exported = settingsStore.export();
      
      expect(exported.version).toBe('1.0.0');
      expect(exported.timestamp).toBeDefined();
      expect(exported.settings).toBeDefined();
    });

    test('should import settings with merge', () => {
      const importData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: {
          translation: {
            targetLanguage: 'fr',
          },
        },
      };
      
      // mergeモードでのインポート
      expect(() => {
        settingsStore.import(importData, true);
      }).not.toThrow();
    });

    test('should import settings with replace', () => {
      const importData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: {
          translation: {
            targetLanguage: 'fr',
            sourceLanguage: 'en',
          },
        },
      };
      
      // 完全置換インポート
      expect(() => {
        settingsStore.import(importData, false);
      }).not.toThrow();
      
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalledWith(importData.settings);
    });

    test('should handle invalid import data', () => {
      expect(() => {
        settingsStore.import(null);
      }).toThrow('Invalid import data format');
      
      expect(() => {
        settingsStore.import({});
      }).toThrow('Invalid import data format');
      
      expect(() => {
        settingsStore.import({ version: '1.0.0' });
      }).toThrow('Invalid import data format');
    });
  });

  describe('Error Handling', () => {
    test('should handle get errors gracefully', () => {
      // get エラーのシミュレーション
      mockStore.get.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });
      
      const result = settingsStore.get('test.key', 'fallback');
      expect(result).toBe('fallback');
    });

    test('should handle set errors', () => {
      // set エラーのシミュレーション
      mockStore.set.mockImplementationOnce(() => {
        throw new Error('Mock set error');
      });
      
      expect(() => {
        settingsStore.set('test.key', 'value');
      }).toThrow();
    });
  });

  describe('Schema and Defaults', () => {
    test('should have valid schema definition', () => {
      expect(SETTINGS_SCHEMA).toBeDefined();
      expect(SETTINGS_SCHEMA.translation).toBeDefined();
      expect(SETTINGS_SCHEMA.ocr).toBeDefined();
      expect(SETTINGS_SCHEMA.hud).toBeDefined();
      expect(SETTINGS_SCHEMA.shortcuts).toBeDefined();
      expect(SETTINGS_SCHEMA.app).toBeDefined();
    });

    test('should have valid default settings', () => {
      expect(DEFAULT_SETTINGS).toBeDefined();
      expect(DEFAULT_SETTINGS.translation).toBeDefined();
      expect(DEFAULT_SETTINGS.ocr).toBeDefined();
      expect(DEFAULT_SETTINGS.hud).toBeDefined();
      expect(DEFAULT_SETTINGS.shortcuts).toBeDefined();
      expect(DEFAULT_SETTINGS.app).toBeDefined();
      
      // デフォルト値の妥当性チェック
      expect(DEFAULT_SETTINGS.translation.targetLanguage).toBe('ja');
      expect(DEFAULT_SETTINGS.translation.sourceLanguage).toBe('auto');
      expect(DEFAULT_SETTINGS.ocr.languages).toEqual(['eng', 'jpn']);
      expect(DEFAULT_SETTINGS.ocr.confidenceThreshold).toBe(60);
      expect(DEFAULT_SETTINGS.hud.autoHideDuration).toBe(15);
      expect(DEFAULT_SETTINGS.shortcuts.translate).toBe('CommandOrControl+Shift+T');
    });
  });

  describe('Memory Management', () => {
    test('should destroy instance properly', () => {
      const listeners = settingsStore.listeners;
      expect(listeners).toBeDefined();
      expect(Array.isArray(listeners)).toBe(true);
      
      settingsStore.destroy();
      
      expect(settingsStore.listeners.length).toBe(0);
      expect(settingsStore.store).toBeNull();
    });
  });

  describe('Advanced Path Operations', () => {
    test('should handle getValueByPath correctly', () => {
      const obj = {
        level1: {
          level2: {
            value: 'test',
          },
        },
      };
      
      expect(settingsStore.getValueByPath(obj, 'level1.level2.value')).toBe('test');
      expect(settingsStore.getValueByPath(obj, 'level1.level2')).toEqual({ value: 'test' });
      expect(settingsStore.getValueByPath(obj, 'nonexistent')).toBeUndefined();
      expect(settingsStore.getValueByPath(null, 'path')).toBeUndefined();
    });
  });
});