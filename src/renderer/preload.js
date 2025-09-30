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
});
