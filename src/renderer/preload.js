const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for Shunyaku v2
 * Provides secure API bridge between renderer and main process
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // IPC communication methods will be added here as needed
  test: () => {
    console.log('ElectronAPI bridge is working');
    return 'Bridge connection successful';
  }
});