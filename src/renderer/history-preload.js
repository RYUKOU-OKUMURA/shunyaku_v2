/**
 * history-preload.js
 * Shunyaku v2 Translation History Window Preload Script
 *
 * このファイルは履歴ウィンドウとメインプロセス間のセキュアな通信を提供します。
 */

const { contextBridge, ipcRenderer } = require('electron');

// セキュアなAPI を renderer プロセスに公開
contextBridge.exposeInMainWorld('electronAPI', {
  // === 履歴データ管理 ===

  /**
   * 翻訳履歴を取得
   * @param {Object} options - 取得オプション
   * @returns {Promise<Object>} 履歴データ
   */
  getTranslationHistory: (options = {}) => ipcRenderer.invoke('get-translation-history', options),

  /**
   * 翻訳履歴統計を取得
   * @returns {Promise<Object>} 統計データ
   */
  getTranslationHistoryStats: () => ipcRenderer.invoke('get-translation-history-stats'),

  /**
   * 履歴設定を取得
   * @returns {Promise<Object>} 設定データ
   */
  getTranslationHistorySettings: () => ipcRenderer.invoke('get-translation-history-settings'),

  // === 履歴検索 ===

  /**
   * 翻訳履歴を検索
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @returns {Promise<Object>} 検索結果
   */
  searchTranslationHistory: (query, options = {}) =>
    ipcRenderer.invoke('search-translation-history', query, options),

  // === 履歴操作 ===

  /**
   * 履歴アイテムのお気に入り状態を切り替え
   * @param {string} itemId - アイテムID
   * @returns {Promise<Object>} 結果
   */
  toggleTranslationFavorite: (itemId) => ipcRenderer.invoke('toggle-translation-favorite', itemId),

  /**
   * 単一の履歴アイテムを削除
   * @param {string} itemId - アイテムID
   * @returns {Promise<Object>} 削除結果
   */
  deleteTranslationHistory: (itemId) => ipcRenderer.invoke('delete-translation-history', itemId),

  /**
   * 複数の履歴アイテムを削除
   * @param {Array<string>} itemIds - アイテムIDの配列
   * @returns {Promise<Object>} 削除結果
   */
  deleteTranslationHistories: (itemIds) =>
    ipcRenderer.invoke('delete-translation-histories', itemIds),

  /**
   * 履歴をクリア
   * @param {Object} options - クリアオプション
   * @returns {Promise<Object>} 結果
   */
  clearTranslationHistory: (options = {}) =>
    ipcRenderer.invoke('clear-translation-history', options),

  // === インポート/エクスポート ===

  /**
   * 履歴をエクスポート
   * @param {Array} items - エクスポートするアイテム
   * @returns {Promise<Object>} エクスポート結果
   */
  exportTranslationHistory: (items) => ipcRenderer.invoke('export-translation-history', items),

  /**
   * 履歴をインポート
   * @param {Object} data - インポートデータ
   * @param {boolean} merge - マージするかどうか
   * @returns {Promise<Object>} インポート結果
   */
  importTranslationHistory: (data, merge = false) =>
    ipcRenderer.invoke('import-translation-history', data, merge),

  // === 設定管理 ===

  /**
   * 最大履歴件数を更新
   * @param {number} maxItems - 最大件数
   * @returns {Promise<Object>} 結果
   */
  updateMaxTranslationHistory: (maxItems) =>
    ipcRenderer.invoke('update-max-translation-history', maxItems),

  // === ウィンドウ制御 ===

  /**
   * 履歴ウィンドウを閉じる
   * @returns {Promise<void>}
   */
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),

  /**
   * ウィンドウを最小化
   * @returns {Promise<void>}
   */
  minimizeHistoryWindow: () => ipcRenderer.invoke('minimize-history-window'),

  /**
   * 設定ウィンドウを開く
   * @returns {Promise<void>}
   */
  openSettings: () => ipcRenderer.invoke('open-settings'),

  // === その他のユーティリティ ===

  /**
   * アプリバージョンを取得
   * @returns {Promise<string>} バージョン
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * システム情報を取得
   * @returns {Promise<Object>} システム情報
   */
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  /**
   * ファイルを開くダイアログを表示
   * @param {Object} options - ダイアログオプション
   * @returns {Promise<Object>} 選択されたファイル情報
   */
  showOpenFileDialog: (options) => ipcRenderer.invoke('show-open-file-dialog', options),

  /**
   * ファイルを保存するダイアログを表示
   * @param {Object} options - ダイアログオプション
   * @returns {Promise<Object>} 保存先情報
   */
  showSaveFileDialog: (options) => ipcRenderer.invoke('show-save-file-dialog', options),

  // === イベントリスナー ===

  /**
   * 履歴更新イベントリスナーを追加
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー削除用関数
   */
  onHistoryUpdated: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('history-updated', listener);

    // リスナー削除用関数を返す
    return () => {
      ipcRenderer.removeListener('history-updated', listener);
    };
  },

  /**
   * 設定変更イベントリスナーを追加
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー削除用関数
   */
  onSettingsChanged: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('settings-changed', listener);

    return () => {
      ipcRenderer.removeListener('settings-changed', listener);
    };
  },

  /**
   * ウィンドウフォーカスイベントリスナーを追加
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー削除用関数
   */
  onWindowFocus: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('window-focus', listener);

    return () => {
      ipcRenderer.removeListener('window-focus', listener);
    };
  },

  /**
   * すべてのイベントリスナーを削除
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners();
  },
});

// === セキュリティ設定 ===

// Node.js統合を無効化（既にcontextIsolation:trueで設定済み）
window.nodeRequire = undefined;
delete window.nodeRequire;

// セキュリティログ
console.log('History preload script loaded successfully');
console.log('Context isolation enabled, secure API bridge established');
