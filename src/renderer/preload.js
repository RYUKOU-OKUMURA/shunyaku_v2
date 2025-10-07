const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for Shunyaku v2
 * Provides secure API bridge between renderer and main process
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // IPC communication methods
  test: () => {
    // eslint-disable-next-line no-console
    console.log('ElectronAPI bridge is working');
    return 'Bridge connection successful';
  },

  // HUD Window control methods
  closeHUD: () => ipcRenderer.invoke('close-hud'),
  hideHUD: () => ipcRenderer.invoke('hide-hud'),
  showHUD: (options) => ipcRenderer.invoke('show-hud', options),

  // マウス位置近傍表示（タスク1.3.4）
  showHUDNearMouse: () => ipcRenderer.invoke('show-hud-near-mouse'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),

  // 翻訳機能（タスク2.5.3）
  translateText: (text, targetLanguage, sourceLanguage = null) =>
    ipcRenderer.invoke('translate-text', { text, targetLanguage, sourceLanguage }),

  // 翻訳設定管理
  getTranslationSettings: () => ipcRenderer.invoke('get-translation-settings'),
  setTranslationSettings: (settings) => ipcRenderer.invoke('set-translation-settings', settings),

  // DeepL API状態確認
  checkTranslationService: () => ipcRenderer.invoke('check-translation-service'),

  // 完全フロー実行（タスク3.4）
  executeFullWorkflow: (options) => ipcRenderer.invoke('execute-full-workflow', options),
  executeShortcutWorkflow: () => ipcRenderer.invoke('execute-shortcut-workflow'),

  // OCR関連（タスク3.3）
  performOCR: (imagePath, options) => ipcRenderer.invoke('perform-ocr', imagePath, options),
  checkOCRHealth: () => ipcRenderer.invoke('check-ocr-health'),

  // スクリーンキャプチャ関連（タスク3.2）
  getAvailableScreens: () => ipcRenderer.invoke('get-available-screens'),
  captureScreen: (sourceId) => ipcRenderer.invoke('capture-screen', sourceId),
  captureHighResScreen: (sourceId) => ipcRenderer.invoke('capture-high-res-screen', sourceId),
  captureAllScreens: () => ipcRenderer.invoke('capture-all-screens'),
  cleanupTempFiles: () => ipcRenderer.invoke('cleanup-temp-files'),
  deleteTempFile: (filePath) => ipcRenderer.invoke('delete-temp-file', filePath),

  // HUD自動非表示機能（タスク4.1）
  toggleHUDPinned: () => ipcRenderer.invoke('toggle-hud-pinned'),
  notifyUserActivity: () => ipcRenderer.invoke('notify-hud-user-activity'),
  updateAutoHideDuration: (duration) => ipcRenderer.invoke('update-hud-auto-hide-duration', duration),

  // HUDイベントリスナー（メインプロセスからの通知を受信）
  onHudAutoHiding: (callback) => {
    ipcRenderer.on('hud-auto-hiding', callback);
    return () => ipcRenderer.removeListener('hud-auto-hiding', callback);
  },
  onHudPinnedModeChanged: (callback) => {
    ipcRenderer.on('hud-pinned-mode-changed', callback);
    return () => ipcRenderer.removeListener('hud-pinned-mode-changed', callback);
  },
  onHudUserActivity: (callback) => {
    ipcRenderer.on('hud-user-activity', callback);
    return () => ipcRenderer.removeListener('hud-user-activity', callback);
  },
});
