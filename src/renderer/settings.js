/**
 * Settings Window JavaScript
 * Handles API key input, validation, and settings management
 */

class SettingsManager {
  constructor() {
    this.elements = {};
    this.currentSettings = {};
    this.init();
  }

  /**
   * Initialize the settings manager
   */
  init() {
    this.cacheElements();
    this.attachEventListeners();
    this.loadSettings();
    this.checkAPIKeyStatus();
    this.loadShortcuts();

    // Initialize shortcut recording state
    this.isRecordingShortcut = false;
    this.currentRecordingAction = null;
    this.recordedKeys = [];
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      // API Key elements
      apiKeyInput: document.getElementById('deepl-api-key'),
      toggleApiKeyBtn: document.getElementById('toggle-api-key'),
      apiKeyValidation: document.getElementById('api-key-validation'),
      apiKeyStatus: document.getElementById('api-key-status'),

      // Language elements
      sourceLanguage: document.getElementById('source-language'),
      targetLanguage: document.getElementById('target-language'),

      // Shortcut elements
      captureShortcutInput: document.getElementById('capture-shortcut'),
      captureShortcutRecord: document.getElementById('capture-shortcut-record'),
      captureShortcutClear: document.getElementById('capture-shortcut-clear'),
      captureShortcutValidation: document.getElementById('capture-shortcut-validation'),
      settingsShortcutInput: document.getElementById('settings-shortcut'),
      settingsShortcutRecord: document.getElementById('settings-shortcut-record'),
      settingsShortcutClear: document.getElementById('settings-shortcut-clear'),
      settingsShortcutValidation: document.getElementById('settings-shortcut-validation'),
      shortcutStatus: document.getElementById('shortcut-status'),
      restoreDefaultShortcutsBtn: document.getElementById('restore-default-shortcuts'),

      // Action buttons
      testApiBtn: document.getElementById('test-api'),
      saveSettingsBtn: document.getElementById('save-settings'),
      resetSettingsBtn: document.getElementById('reset-settings'),
      deleteApiKeyBtn: document.getElementById('delete-api-key'),
      closeBtn: document.getElementById('close-settings'),

      // Status and UI elements
      statusMessages: document.getElementById('status-messages'),
      loadingOverlay: document.getElementById('loading-overlay'),
    };
  }

  /**
   * Attach event listeners to DOM elements
   */
  attachEventListeners() {
    // API Key input validation
    this.elements.apiKeyInput.addEventListener('input', () => {
      this.validateAPIKey();
    });

    this.elements.apiKeyInput.addEventListener('paste', () => {
      setTimeout(() => this.validateAPIKey(), 10);
    });

    // Toggle API key visibility
    this.elements.toggleApiKeyBtn.addEventListener('click', () => {
      this.toggleAPIKeyVisibility();
    });

    // Action buttons
    this.elements.testApiBtn.addEventListener('click', () => {
      this.testAPIConnection();
    });

    this.elements.saveSettingsBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    this.elements.resetSettingsBtn.addEventListener('click', () => {
      this.resetSettings();
    });

    this.elements.deleteApiKeyBtn.addEventListener('click', () => {
      this.deleteAPIKey();
    });

    this.elements.closeBtn.addEventListener('click', () => {
      this.closeSettings();
    });

    // Language change handlers
    this.elements.sourceLanguage.addEventListener('change', () => {
      this.onSettingsChange();
    });

    this.elements.targetLanguage.addEventListener('change', () => {
      this.onSettingsChange();
    });

    // Shortcut event listeners
    this.elements.captureShortcutRecord.addEventListener('click', () => {
      this.startRecordingShortcut('capture');
    });

    this.elements.captureShortcutClear.addEventListener('click', () => {
      this.clearShortcut('capture');
    });

    this.elements.settingsShortcutRecord.addEventListener('click', () => {
      this.startRecordingShortcut('showSettings');
    });

    this.elements.settingsShortcutClear.addEventListener('click', () => {
      this.clearShortcut('showSettings');
    });

    this.elements.restoreDefaultShortcutsBtn.addEventListener('click', () => {
      this.restoreDefaultShortcuts();
    });

    // Window events
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettings();
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.saveSettings();
      }
    });
  }

  /**
   * Load current settings from main process
   */
  async loadSettings() {
    try {
      this.showLoading(true, 'Loading settings...');

      // Load settings via IPC
      const settings = await window.electronAPI.getSettings();
      this.currentSettings = settings;

      // Load existing API key status
      const hasApiKey = await window.electronAPI.hasAPIKey('deepl');

      // Update UI with current settings
      this.updateUI(settings, hasApiKey);

      this.showMessage('Settings loaded successfully', 'success');
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showMessage(`Failed to load settings: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Update UI elements with current settings
   */
  updateUI(settings, hasApiKey) {
    // Update language settings
    if (settings.translation) {
      this.elements.sourceLanguage.value = settings.translation.sourceLanguage || 'auto';
      this.elements.targetLanguage.value = settings.translation.targetLanguage || 'ja';
    }

    // Update API key status
    this.updateAPIKeyStatus(hasApiKey);

    // Enable/disable API-related buttons
    this.elements.testApiBtn.disabled = !hasApiKey;
    this.elements.deleteApiKeyBtn.disabled = !hasApiKey;
  }

  /**
   * Validate DeepL API key format
   */
  validateAPIKey() {
    const apiKey = this.elements.apiKeyInput.value.trim();
    const validationEl = this.elements.apiKeyValidation;

    if (!apiKey) {
      validationEl.textContent = '';
      validationEl.className = 'validation-message';
      this.elements.testApiBtn.disabled = true;
      return false;
    }

    // DeepL API key format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
    const deepLPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:fx$/;

    if (deepLPattern.test(apiKey)) {
      validationEl.textContent = '✓ Valid DeepL API key format';
      validationEl.className = 'validation-message success';
      this.elements.testApiBtn.disabled = false;
      return true;
    } else {
      validationEl.textContent =
        '⚠ Invalid API key format. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx';
      validationEl.className = 'validation-message error';
      this.elements.testApiBtn.disabled = true;
      return false;
    }
  }

  /**
   * Toggle API key input visibility
   */
  toggleAPIKeyVisibility() {
    const input = this.elements.apiKeyInput;
    const btn = this.elements.toggleApiKeyBtn;

    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
      btn.title = 'Hide API Key';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
      btn.title = 'Show API Key';
    }
  }

  /**
   * Test API connection with current key
   */
  async testAPIConnection() {
    const apiKey = this.elements.apiKeyInput.value.trim();

    if (!apiKey || !this.validateAPIKey()) {
      this.showMessage('Please enter a valid API key first', 'error');
      return;
    }

    try {
      this.showLoading(true, 'Testing API connection...');

      // Test the API key via IPC
      const result = await window.electronAPI.testAPIKey(apiKey);

      if (result.success) {
        this.showMessage('✓ API connection successful!', 'success');
        this.updateAPIKeyStatus(true, 'Connected');
      } else {
        this.showMessage(`API test failed: ${result.error}`, 'error');
        this.updateAPIKeyStatus(false, 'Connection failed');
      }
    } catch (error) {
      console.error('API test failed:', error);
      this.showMessage(`API test failed: ${error.message}`, 'error');
      this.updateAPIKeyStatus(false, 'Test failed');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Save all settings including API key
   */
  async saveSettings() {
    try {
      this.showLoading(true, 'Saving settings...');

      const settings = {
        translation: {
          sourceLanguage: this.elements.sourceLanguage.value,
          targetLanguage: this.elements.targetLanguage.value,
        },
      };

      // Save settings via IPC
      await window.electronAPI.saveSettings(settings);

      // Save API key if provided
      const apiKey = this.elements.apiKeyInput.value.trim();
      if (apiKey && this.validateAPIKey()) {
        await window.electronAPI.saveAPIKey('deepl', apiKey);
        this.updateAPIKeyStatus(true, 'Saved');
        this.elements.testApiBtn.disabled = false;
        this.elements.deleteApiKeyBtn.disabled = false;

        // Clear the input for security
        this.elements.apiKeyInput.value = '';
        this.elements.apiKeyValidation.textContent = '';
        this.elements.apiKeyValidation.className = 'validation-message';
      }

      this.currentSettings = settings;
      this.showMessage('✓ Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showMessage(`Failed to save settings: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Reset all settings to default values
   */
  async resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to default values?')) {
      return;
    }

    try {
      this.showLoading(true, 'Resetting settings...');

      // Reset to default values
      this.elements.sourceLanguage.value = 'auto';
      this.elements.targetLanguage.value = 'ja';
      this.elements.apiKeyInput.value = '';
      this.elements.apiKeyValidation.textContent = '';
      this.elements.apiKeyValidation.className = 'validation-message';

      // Save default settings
      const defaultSettings = {
        translation: {
          sourceLanguage: 'auto',
          targetLanguage: 'ja',
        },
      };

      await window.electronAPI.saveSettings(defaultSettings);

      this.currentSettings = defaultSettings;
      this.showMessage('✓ Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showMessage(`Failed to reset settings: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Delete stored API key
   */
  async deleteAPIKey() {
    if (
      !confirm('Are you sure you want to delete the stored API key? This action cannot be undone.')
    ) {
      return;
    }

    try {
      this.showLoading(true, 'Deleting API key...');

      await window.electronAPI.deleteAPIKey('deepl');

      this.updateAPIKeyStatus(false, 'Not configured');
      this.elements.testApiBtn.disabled = true;
      this.elements.deleteApiKeyBtn.disabled = true;

      this.showMessage('✓ API key deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      this.showMessage(`Failed to delete API key: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Check current API key status
   */
  async checkAPIKeyStatus() {
    try {
      const hasApiKey = await window.electronAPI.hasAPIKey('deepl');
      this.updateAPIKeyStatus(hasApiKey);

      this.elements.testApiBtn.disabled = !hasApiKey;
      this.elements.deleteApiKeyBtn.disabled = !hasApiKey;
    } catch (error) {
      console.error('Failed to check API key status:', error);
      this.updateAPIKeyStatus(false, 'Status check failed');
    }
  }

  /**
   * Update API key status indicator
   */
  updateAPIKeyStatus(hasKey, statusText = null) {
    const statusEl = this.elements.apiKeyStatus;
    const iconEl = statusEl.querySelector('.status-icon');
    const textEl = statusEl.querySelector('.status-text');

    if (hasKey) {
      iconEl.textContent = '✅';
      textEl.textContent = statusText || 'Configured';
      statusEl.className = 'status-indicator connected';
    } else {
      iconEl.textContent = '❌';
      textEl.textContent = statusText || 'Not configured';
      statusEl.className = 'status-indicator error';
    }
  }

  /**
   * Handle settings changes
   */
  onSettingsChange() {
    // Enable save button when settings change
    this.elements.saveSettingsBtn.classList.add('pulse');
    setTimeout(() => {
      this.elements.saveSettingsBtn.classList.remove('pulse');
    }, 2000);
  }

  /**
   * Show loading overlay
   */
  showLoading(show, text = 'Processing...') {
    const overlay = this.elements.loadingOverlay;
    const textEl = overlay.querySelector('.loading-text');

    if (show) {
      textEl.textContent = text;
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  /**
   * Show status message
   */
  showMessage(message, type = 'info') {
    const messagesEl = this.elements.statusMessages;
    messagesEl.textContent = message;
    messagesEl.className = `status-messages ${type} fade-in`;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        messagesEl.textContent = '';
        messagesEl.className = 'status-messages';
      }, 5000);
    }
  }

  /**
   * Close settings window
   */
  closeSettings() {
    window.electronAPI.closeWindow();
  }

  /**
   * Cleanup when window closes
   */
  cleanup() {
    // Clear any sensitive data from memory
    if (this.elements.apiKeyInput) {
      this.elements.apiKeyInput.value = '';
    }
  }

  /**
   * Load current shortcuts from main process
   */
  async loadShortcuts() {
    try {
      this.showShortcutStatus('Loading shortcuts...', '⏳');

      const result = await window.electronAPI.getRegisteredShortcuts();

      if (result.success) {
        const shortcuts = result.shortcuts;

        // Update shortcut input fields
        if (shortcuts.capture) {
          const formatted = await this.formatShortcutForDisplay(shortcuts.capture);
          this.elements.captureShortcutInput.value = formatted;
        }

        if (shortcuts.showSettings) {
          const formatted = await this.formatShortcutForDisplay(shortcuts.showSettings);
          this.elements.settingsShortcutInput.value = formatted;
        }

        this.showShortcutStatus('Shortcuts loaded', '✅');
      } else {
        console.error('Failed to load shortcuts:', result.error);
        this.showShortcutStatus('Failed to load shortcuts', '❌');
      }
    } catch (error) {
      console.error('Error loading shortcuts:', error);
      this.showShortcutStatus('Error loading shortcuts', '❌');
    }
  }

  /**
   * Start recording a new shortcut
   */
  async startRecordingShortcut(action) {
    try {
      if (this.isRecordingShortcut) {
        this.stopRecordingShortcut();
        return;
      }

      this.isRecordingShortcut = true;
      this.currentRecordingAction = action;
      this.recordedKeys = [];

      // Update UI for recording state
      const inputElement =
        action === 'capture'
          ? this.elements.captureShortcutInput
          : this.elements.settingsShortcutInput;
      const recordBtn =
        action === 'capture'
          ? this.elements.captureShortcutRecord
          : this.elements.settingsShortcutRecord;

      inputElement.classList.add('recording');
      inputElement.value = 'Press keys...';
      recordBtn.classList.add('recording');
      recordBtn.innerHTML = '<span class="btn-icon">⏺</span>Recording...';

      // Add global keydown listener for recording
      this.recordingKeyHandler = (e) => this.handleRecordingKeydown(e);
      document.addEventListener('keydown', this.recordingKeyHandler, true);

      // Auto-stop recording after 10 seconds
      this.recordingTimeout = setTimeout(() => {
        this.stopRecordingShortcut();
        this.showShortcutValidation(action, 'Recording timed out', 'error');
      }, 10000);
    } catch (error) {
      console.error('Error starting shortcut recording:', error);
      this.stopRecordingShortcut();
    }
  }

  /**
   * Handle keydown events during shortcut recording
   */
  handleRecordingKeydown(e) {
    if (!this.isRecordingShortcut) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Build accelerator string
    const keys = [];

    // Add modifiers
    if (e.metaKey) {
      keys.push('CommandOrControl');
    }
    if (e.ctrlKey && !e.metaKey) {
      keys.push('Control');
    }
    if (e.altKey) {
      keys.push('Alt');
    }
    if (e.shiftKey) {
      keys.push('Shift');
    }

    // Add main key
    if (e.key && e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
      let key = e.key;

      // Convert special keys
      if (key === ' ') {
        key = 'Space';
      } else if (key.length === 1) {
        key = key.toUpperCase();
      }

      keys.push(key);

      // Complete recording
      const accelerator = keys.join('+');
      this.completeRecording(accelerator);
    }
  }

  /**
   * Complete shortcut recording with the given accelerator
   */
  async completeRecording(accelerator) {
    if (!this.isRecordingShortcut || !this.currentRecordingAction) {
      return;
    }

    try {
      const action = this.currentRecordingAction;

      // Validate shortcut
      const validationResult = await window.electronAPI.validateShortcut(accelerator);
      if (!validationResult.success || !validationResult.isValid) {
        this.showShortcutValidation(action, 'Invalid key combination', 'error');
        this.stopRecordingShortcut();
        return;
      }

      // Check for conflicts
      const conflictResult = await window.electronAPI.checkShortcutConflict(accelerator);
      if (!conflictResult.success) {
        this.showShortcutValidation(action, 'Error checking conflicts', 'error');
        this.stopRecordingShortcut();
        return;
      }

      if (conflictResult.isConflicting) {
        this.showShortcutValidation(
          action,
          'This shortcut is already in use by another application',
          'error'
        );
        this.stopRecordingShortcut();
        return;
      }

      // Register the shortcut
      const registerResult = await window.electronAPI.registerShortcut(action, accelerator);
      if (!registerResult.success) {
        this.showShortcutValidation(action, 'Failed to register shortcut', 'error');
        this.stopRecordingShortcut();
        return;
      }

      // Update UI with formatted shortcut
      const formatted = await this.formatShortcutForDisplay(accelerator);
      const inputElement =
        action === 'capture'
          ? this.elements.captureShortcutInput
          : this.elements.settingsShortcutInput;

      inputElement.value = formatted;
      this.showShortcutValidation(action, 'Shortcut registered successfully', 'success');
    } catch (error) {
      console.error('Error completing recording:', error);
      this.showShortcutValidation(
        this.currentRecordingAction,
        'Failed to register shortcut',
        'error'
      );
    }

    this.stopRecordingShortcut();
  }

  /**
   * Stop shortcut recording
   */
  stopRecordingShortcut() {
    if (!this.isRecordingShortcut) {
      return;
    }

    this.isRecordingShortcut = false;
    const action = this.currentRecordingAction;
    this.currentRecordingAction = null;
    this.recordedKeys = [];

    // Remove event listener
    if (this.recordingKeyHandler) {
      document.removeEventListener('keydown', this.recordingKeyHandler, true);
      this.recordingKeyHandler = null;
    }

    // Clear timeout
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    // Reset UI
    if (action) {
      const inputElement =
        action === 'capture'
          ? this.elements.captureShortcutInput
          : this.elements.settingsShortcutInput;
      const recordBtn =
        action === 'capture'
          ? this.elements.captureShortcutRecord
          : this.elements.settingsShortcutRecord;

      inputElement.classList.remove('recording');
      recordBtn.classList.remove('recording');
      recordBtn.innerHTML = '<span class="btn-icon">🎯</span>Record';

      // If input is empty, restore previous value or placeholder
      if (!inputElement.value || inputElement.value === 'Press keys...') {
        inputElement.value = '';
      }
    }
  }

  /**
   * Clear a shortcut
   */
  async clearShortcut(action) {
    try {
      const result = await window.electronAPI.unregisterShortcut(action);

      if (result.success) {
        const inputElement =
          action === 'capture'
            ? this.elements.captureShortcutInput
            : this.elements.settingsShortcutInput;

        inputElement.value = '';
        this.showShortcutValidation(action, 'Shortcut cleared', 'success');
      } else {
        this.showShortcutValidation(action, 'Failed to clear shortcut', 'error');
      }
    } catch (error) {
      console.error('Error clearing shortcut:', error);
      this.showShortcutValidation(action, 'Error clearing shortcut', 'error');
    }
  }

  /**
   * Restore default shortcuts
   */
  async restoreDefaultShortcuts() {
    try {
      this.showShortcutStatus('Restoring defaults...', '⏳');

      const result = await window.electronAPI.restoreDefaultShortcuts();

      if (result.success) {
        this.showShortcutStatus('Defaults restored', '✅');
        this.showMessage('Default shortcuts restored successfully', 'success');

        // Reload shortcuts to update UI
        await this.loadShortcuts();
      } else {
        this.showShortcutStatus('Failed to restore defaults', '❌');
        this.showMessage('Failed to restore default shortcuts', 'error');
      }
    } catch (error) {
      console.error('Error restoring default shortcuts:', error);
      this.showShortcutStatus('Error restoring defaults', '❌');
      this.showMessage('Error restoring default shortcuts', 'error');
    }
  }

  /**
   * Format shortcut for display (convert to macOS format)
   */
  async formatShortcutForDisplay(accelerator) {
    try {
      const result = await window.electronAPI.formatShortcut(accelerator);
      return result.success ? result.formatted : accelerator;
    } catch (error) {
      console.error('Error formatting shortcut:', error);
      return accelerator;
    }
  }

  /**
   * Show shortcut validation message
   */
  showShortcutValidation(action, message, type) {
    const validationElement =
      action === 'capture'
        ? this.elements.captureShortcutValidation
        : this.elements.settingsShortcutValidation;

    if (!validationElement) {
      return;
    }

    validationElement.textContent = message;
    validationElement.className = `validation-message ${type}`;

    // Auto-clear after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        validationElement.textContent = '';
        validationElement.className = 'validation-message';
      }, 5000);
    }
  }

  /**
   * Show shortcut status
   */
  showShortcutStatus(message, icon) {
    if (this.elements.shortcutStatus) {
      const iconElement = this.elements.shortcutStatus.querySelector('.status-icon');
      const textElement = this.elements.shortcutStatus.querySelector('.status-text');

      if (iconElement) {
        iconElement.textContent = icon;
      }
      if (textElement) {
        textElement.textContent = message;
      }
    }
  }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
});

// Add pulse animation for save button
const style = document.createElement('style');
style.textContent = `
    .pulse {
        animation: pulse 0.5s ease-in-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);
