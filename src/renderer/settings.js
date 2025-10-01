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
