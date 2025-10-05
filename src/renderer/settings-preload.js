/**
 * Settings Window Preload Script
 * Exposes secure IPC methods for settings management
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Settings management
   */
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),

  /**
   * API key management
   */
  hasAPIKey: (keyName) => ipcRenderer.invoke('has-api-key', keyName),
  saveAPIKey: (keyName, keyValue) => ipcRenderer.invoke('save-api-key', keyName, keyValue),
  deleteAPIKey: (keyName) => ipcRenderer.invoke('delete-api-key', keyName),
  testAPIKey: (keyValue) => ipcRenderer.invoke('test-api-key', keyValue),

  /**
   * Window management
   */
  closeWindow: () => ipcRenderer.invoke('close-settings-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-settings-window'),

  /**
   * Application info
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Settings window events
   */
  onSettingsChange: (callback) => {
    const wrapper = (event, ...args) => callback(...args);
    ipcRenderer.on('settings-changed', wrapper);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('settings-changed', wrapper);
  },

  onAPIKeyChange: (callback) => {
    const wrapper = (event, ...args) => callback(...args);
    ipcRenderer.on('api-key-changed', wrapper);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('api-key-changed', wrapper);
  },

  /**
   * Language management
   */
  getSupportedLanguages: () => ipcRenderer.invoke('get-supported-languages'),

  /**
   * Translation test
   */
  testTranslation: (text, targetLang) => ipcRenderer.invoke('test-translation', text, targetLang),

  /**
   * Global shortcuts management
   */
  getRegisteredShortcuts: () => ipcRenderer.invoke('get-registered-shortcuts'),
  registerShortcut: (action, accelerator) =>
    ipcRenderer.invoke('register-shortcut', action, accelerator),
  unregisterShortcut: (action) => ipcRenderer.invoke('unregister-shortcut', action),
  checkShortcutConflict: (accelerator) =>
    ipcRenderer.invoke('check-shortcut-conflict', accelerator),
  validateShortcut: (accelerator) => ipcRenderer.invoke('validate-shortcut', accelerator),
  formatShortcut: (accelerator) => ipcRenderer.invoke('format-shortcut', accelerator),
  restoreDefaultShortcuts: () => ipcRenderer.invoke('restore-default-shortcuts'),
  exportShortcutSettings: () => ipcRenderer.invoke('export-shortcut-settings'),
  importShortcutSettings: (settings) => ipcRenderer.invoke('import-shortcut-settings', settings),
});

// Security: Remove dangerous globals
delete window.require;
delete window.exports;
delete window.module;

// Log preload script initialization
console.log('Settings preload script initialized');
