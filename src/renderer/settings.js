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

      // OCR elements
      ocrLanguagesGroup: document.getElementById('ocr-languages-group'),
      ocrConfidence: document.getElementById('ocr-confidence'),
      ocrConfidenceValue: document.getElementById('ocr-confidence-value'),
      ocrPsm: document.getElementById('ocr-psm'),

      // HUD elements
      hudTheme: document.getElementById('hud-theme'),
      hudWidth: document.getElementById('hud-width'),
      hudHeight: document.getElementById('hud-height'),
      hudOpacity: document.getElementById('hud-opacity'),
      hudOpacityValue: document.getElementById('hud-opacity-value'),
      autoHideDuration: document.getElementById('auto-hide-duration'),
      autoHideDurationValue: document.getElementById('auto-hide-duration-value'),
      hudPositionRadios: document.querySelectorAll('input[name="hud-position"]'),
      fixedPositionControls: document.getElementById('fixed-position-controls'),
      hudX: document.getElementById('hud-x'),
      hudY: document.getElementById('hud-y'),

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

    // OCR settings handlers
    const ocrCheckboxes =
      this.elements.ocrLanguagesGroup.querySelectorAll('input[type="checkbox"]');
    ocrCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        this.onSettingsChange();
      });
    });

    this.elements.ocrConfidence.addEventListener('input', (e) => {
      this.elements.ocrConfidenceValue.textContent = e.target.value;
      this.onSettingsChange();
    });

    this.elements.ocrPsm.addEventListener('change', () => {
      this.onSettingsChange();
    });

    // HUD settings handlers
    this.elements.hudTheme.addEventListener('change', () => {
      this.onSettingsChange();
    });

    this.elements.hudWidth.addEventListener('input', () => {
      this.onSettingsChange();
    });

    this.elements.hudHeight.addEventListener('input', () => {
      this.onSettingsChange();
    });

    this.elements.hudOpacity.addEventListener('input', (e) => {
      const percentage = Math.round(e.target.value * 100);
      this.elements.hudOpacityValue.textContent = percentage;
      this.onSettingsChange();
    });

    this.elements.autoHideDuration.addEventListener('input', (e) => {
      this.elements.autoHideDurationValue.textContent = e.target.value;
      this.onSettingsChange();
    });

    // HUD position handlers
    this.elements.hudPositionRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.updateFixedPositionControls();
        this.onSettingsChange();
      });
    });

    this.elements.hudX.addEventListener('input', () => {
      this.onSettingsChange();
    });

    this.elements.hudY.addEventListener('input', () => {
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

    // Update OCR settings
    if (settings.ocr) {
      // Update OCR language checkboxes
      const ocrLanguages = settings.ocr.languages || ['eng', 'jpn'];
      const checkboxes = this.elements.ocrLanguagesGroup.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = ocrLanguages.includes(checkbox.value);
      });

      // Update confidence threshold
      const confidence = settings.ocr.confidenceThreshold || 60;
      this.elements.ocrConfidence.value = confidence;
      this.elements.ocrConfidenceValue.textContent = confidence;

      // Update PSM
      this.elements.ocrPsm.value = settings.ocr.psm || 6;
    }

    // Update HUD settings
    if (settings.hud) {
      this.elements.hudTheme.value = settings.hud.theme || 'auto';

      const size = settings.hud.size || { width: 400, height: 300 };
      this.elements.hudWidth.value = size.width;
      this.elements.hudHeight.value = size.height;

      const opacity = settings.hud.opacity || 0.95;
      this.elements.hudOpacity.value = opacity;
      this.elements.hudOpacityValue.textContent = Math.round(opacity * 100);

      const autoHide = settings.hud.autoHideDuration || 15;
      this.elements.autoHideDuration.value = autoHide;
      this.elements.autoHideDurationValue.textContent = autoHide;

      // Update position settings
      const position = settings.hud.position || 'mouse';
      this.elements.hudPositionRadios.forEach((radio) => {
        radio.checked = radio.value === position;
      });

      // Update fixed position values
      if (settings.hud.fixedPosition) {
        this.elements.hudX.value = settings.hud.fixedPosition.x || 100;
        this.elements.hudY.value = settings.hud.fixedPosition.y || 100;
      }

      this.updateFixedPositionControls();
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

      // Collect all form data including new settings
      const settings = this.collectFormData();

      // Validate settings
      if (settings.ocr.languages.length === 0) {
        throw new Error('At least one OCR language must be selected');
      }

      if (settings.hud.size.width < 200 || settings.hud.size.width > 800) {
        throw new Error('HUD width must be between 200 and 800 pixels');
      }

      if (settings.hud.size.height < 150 || settings.hud.size.height > 600) {
        throw new Error('HUD height must be between 150 and 600 pixels');
      }

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

/**
 * ショートカット設定関連の機能（タスク3.6.4）
 * キーボードショートカットのカスタマイズUI
 */

// ショートカット管理のグローバル状態
const shortcutManager = {
  recording: false,
  recordingInput: null,
  currentShortcuts: {},
  availableShortcuts: {},

  // キーマッピング
  keyMap: {
    ' ': 'Space',
    Meta: 'Command',
    Control: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Shift',
    Tab: 'Tab',
    Escape: 'Escape',
    Enter: 'Enter',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert',
    Delete: 'Delete',
    Backspace: 'Backspace',
  },

  // macOSのキーマッピング（表示用）
  displayMap: {
    CommandOrControl: '⌘',
    Command: '⌘',
    Ctrl: '^',
    Control: '^',
    Alt: '⌥',
    Option: '⌥',
    Shift: '⇧',
    Space: '␣',
    Tab: '⇥',
    Escape: '⎋',
    Enter: '↩',
    Up: '↑',
    Down: '↓',
    Left: '←',
    Right: '→',
    Delete: '⌦',
    Backspace: '⌫',
  },
};

/**
 * ショートカット設定の初期化
 */
async function initializeShortcuts() {
  try {
    console.log('🎯 Initializing shortcut settings...');

    // 利用可能なショートカットを取得
    const availableResult = await window.electronAPI.invoke('get-available-shortcuts');
    if (availableResult.success) {
      shortcutManager.availableShortcuts = availableResult.shortcuts;
    }

    // 現在のショートカット設定を取得
    await loadShortcutSettings();

    // 現在登録されているショートカットを取得
    await loadRegisteredShortcuts();

    // イベントリスナーの設定
    setupShortcutEventListeners();

    console.log('✅ Shortcut settings initialized');
  } catch (error) {
    console.error('❌ Failed to initialize shortcuts:', error);
    console.error('Failed to load shortcut settings');
  }
}

/**
 * ショートカット設定をロード
 */
async function loadShortcutSettings() {
  try {
    const settings = await window.electronAPI.invoke('get-settings');
    const shortcutSettings = settings.shortcuts;

    // 各ショートカット入力フィールドに設定値を設定
    const shortcutMappings = {
      'shortcut-translate': shortcutSettings.translate,
      'shortcut-settings': shortcutSettings.showSettings,
      'shortcut-toggle-hud': shortcutSettings.toggleHUD,
    };

    for (const [inputId, accelerator] of Object.entries(shortcutMappings)) {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = formatAcceleratorForDisplay(accelerator);
        input.dataset.accelerator = accelerator;
      }
    }

    shortcutManager.currentShortcuts = shortcutSettings;
  } catch (error) {
    console.error('❌ Failed to load shortcut settings:', error);
    throw error;
  }
}

/**
 * 現在登録されているショートカットを取得して表示
 */
async function loadRegisteredShortcuts() {
  try {
    const result = await window.electronAPI.invoke('get-registered-shortcuts');

    if (result.success) {
      displayActiveShortcuts(result.shortcuts);
    }
  } catch (error) {
    console.error('❌ Failed to load registered shortcuts:', error);
  }
}

/**
 * アクティブなショートカット一覧を表示
 */
function displayActiveShortcuts(shortcuts) {
  const container = document.getElementById('active-shortcuts');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  for (const [key, info] of Object.entries(shortcuts)) {
    const shortcutItem = document.createElement('div');
    shortcutItem.className = 'shortcut-item';

    const shortcutName = getShortcutDisplayName(key);

    shortcutItem.innerHTML = `
      <div class="shortcut-info">
        <div class="shortcut-name">${shortcutName}</div>
        <div class="shortcut-description">${info.description}</div>
      </div>
      <div class="shortcut-key">${formatAcceleratorForDisplay(info.accelerator)}</div>
    `;

    container.appendChild(shortcutItem);
  }

  if (Object.keys(shortcuts).length === 0) {
    container.innerHTML =
      '<div class="shortcut-item"><em>No shortcuts currently registered</em></div>';
  }
}

/**
 * ショートカット表示名を取得
 */
function getShortcutDisplayName(key) {
  const displayNames = {
    translate: 'Translation',
    showSettings: 'Settings',
    toggleHUD: 'Toggle HUD',
  };

  return displayNames[key] || key;
}

/**
 * アクセレレーターを表示用にフォーマット
 */
function formatAcceleratorForDisplay(accelerator) {
  if (!accelerator) {
    return '';
  }

  return accelerator
    .split('+')
    .map((part) => shortcutManager.displayMap[part] || part)
    .join('');
}

/**
 * イベントリスナーの設定
 */
function setupShortcutEventListeners() {
  // ショートカット入力フィールド
  const shortcutInputs = document.querySelectorAll('.shortcut-input');
  shortcutInputs.forEach((input) => {
    input.addEventListener('focus', startRecordingShortcut);
    input.addEventListener('blur', stopRecordingShortcut);
    input.addEventListener('keydown', handleShortcutKeydown);
  });

  // クリアボタン
  const clearButtons = document.querySelectorAll('.shortcut-clear');
  clearButtons.forEach((button) => {
    button.addEventListener('click', clearShortcut);
  });
}

/**
 * ショートカットの録画開始
 */
function startRecordingShortcut(event) {
  const input = event.target;

  if (shortcutManager.recording) {
    return;
  }

  shortcutManager.recording = true;
  shortcutManager.recordingInput = input;

  input.classList.add('recording');
  input.value = 'Press keys...';
  input.dataset.placeholder = input.value;

  console.log('🎯 Started recording shortcut for:', input.id);
}

/**
 * ショートカットの録画停止
 */
function stopRecordingShortcut(event) {
  const input = event.target;

  if (!shortcutManager.recording || shortcutManager.recordingInput !== input) {
    return;
  }

  shortcutManager.recording = false;
  shortcutManager.recordingInput = null;

  input.classList.remove('recording', 'valid', 'invalid');

  // 録画中に何も入力されなかった場合
  if (input.value === 'Press keys...' || input.value === '') {
    input.value = formatAcceleratorForDisplay(input.dataset.accelerator || '');
  }

  console.log('🎯 Stopped recording shortcut for:', input.id);
}

/**
 * ショートカットキーダウンハンドラー
 */
async function handleShortcutKeydown(event) {
  if (!shortcutManager.recording) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const input = event.target;

  // 修飾キーのみの場合は無視
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    return;
  }

  // ショートカット文字列を構築
  const modifiers = [];
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (event.metaKey) {
    modifiers.push(isMac ? 'Command' : 'CommandOrControl');
  }
  if (event.ctrlKey && !event.metaKey) {
    modifiers.push('Control');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  // キー名を取得
  let keyName = shortcutManager.keyMap[event.key] || event.key;

  // 文字キーの場合は大文字に
  if (keyName.length === 1) {
    keyName = keyName.toUpperCase();
  }

  // 最低でも1つの修飾キーが必要
  if (modifiers.length === 0) {
    input.value = 'Must include modifier key (⌘, ^, ⌥, ⇧)';
    input.classList.add('invalid');
    setTimeout(() => {
      input.classList.remove('invalid');
      input.value = 'Press keys...';
    }, 1500);
    return;
  }

  const accelerator = [...modifiers, keyName].join('+');

  try {
    // ショートカットの有効性と可用性をチェック
    const testResult = await window.electronAPI.invoke('test-shortcut-availability', accelerator);

    if (!testResult.valid) {
      input.value = 'Invalid key combination';
      input.classList.add('invalid');
      setTimeout(() => {
        input.classList.remove('invalid');
        input.value = 'Press keys...';
      }, 1500);
      return;
    }

    // 設定
    input.value = formatAcceleratorForDisplay(accelerator);
    input.dataset.accelerator = accelerator;
    input.classList.add('valid');

    // 競合チェック（別のフィールドで同じショートカットが使用されているか）
    checkShortcutConflicts(input);

    console.log('✅ Shortcut set:', accelerator);
  } catch (error) {
    console.error('❌ Failed to test shortcut:', error);
    input.value = 'Error testing shortcut';
    input.classList.add('invalid');
  }
}

/**
 * ショートカットの競合をチェック
 */
function checkShortcutConflicts(currentInput) {
  const currentAccelerator = currentInput.dataset.accelerator;
  const shortcutInputs = document.querySelectorAll('.shortcut-input');

  shortcutInputs.forEach((input) => {
    if (input === currentInput) {
      return;
    }

    if (input.dataset.accelerator === currentAccelerator) {
      // 競合している入力フィールドをクリア
      input.value = '';
      input.dataset.accelerator = '';
      input.classList.remove('valid');

      // 警告を表示
      showShortcutConflictWarning(formatAcceleratorForDisplay(currentAccelerator));
    }
  });
}

/**
 * ショートカットの競合警告を表示
 */
function showShortcutConflictWarning(accelerator) {
  // 既存の警告を削除
  const existingWarning = document.querySelector('.shortcut-warning');
  if (existingWarning) {
    existingWarning.remove();
  }

  const shortcutStatus = document.querySelector('.shortcut-status');
  const warning = document.createElement('div');
  warning.className = 'shortcut-warning';
  warning.innerHTML = `
    <span class="warning-icon">⚠️</span>
    <span>Shortcut conflict resolved: ${accelerator} was reassigned</span>
  `;

  shortcutStatus.appendChild(warning);

  // 3秒後に警告を削除
  setTimeout(() => {
    warning.remove();
  }, 3000);
}

/**
 * ショートカットをクリア
 */
function clearShortcut(event) {
  const button = event.target.closest('.shortcut-clear');
  const targetId = button.dataset.target;
  const input = document.getElementById(targetId);

  if (input) {
    input.value = '';
    input.dataset.accelerator = '';
    input.classList.remove('valid', 'invalid');

    console.log('🗑 Cleared shortcut for:', targetId);
  }
}

/**
 * ショートカット設定を保存
 */
async function saveShortcutSettings() {
  try {
    const newSettings = {};

    // 各ショートカット入力から設定を収集
    const shortcutMappings = {
      'shortcut-translate': 'translate',
      'shortcut-settings': 'showSettings',
      'shortcut-toggle-hud': 'toggleHUD',
    };

    for (const [inputId, settingKey] of Object.entries(shortcutMappings)) {
      const input = document.getElementById(inputId);
      const accelerator = input?.dataset.accelerator;

      if (accelerator && accelerator.trim() !== '') {
        newSettings[settingKey] = accelerator;
      } else {
        // デフォルト値を使用
        const defaultValue = shortcutManager.availableShortcuts[settingKey]?.accelerator;
        if (defaultValue) {
          newSettings[settingKey] = defaultValue;
        }
      }
    }

    // グローバルショートカットを更新
    const result = await window.electronAPI.invoke('update-global-shortcuts', newSettings);

    if (result.success) {
      shortcutManager.currentShortcuts = newSettings;

      // 登録されているショートカットの表示を更新
      await loadRegisteredShortcuts();

      console.log('✅ Shortcut settings saved successfully');
      console.log('✅ Shortcut settings saved');
    } else {
      throw new Error(result.error || 'Failed to update shortcuts');
    }
  } catch (error) {
    console.error('❌ Failed to save shortcut settings:', error);
    console.error(`Failed to save shortcuts: ${error.message}`);
  }
}

// DOMロード時にショートカット設定を初期化
document.addEventListener('DOMContentLoaded', () => {
  // 少し遅延させてメインの初期化が完了してから実行
  setTimeout(initializeShortcuts, 500);
});

// 設定保存時にショートカット設定も保存
const originalSaveSettings = window.saveSettings;
if (originalSaveSettings) {
  window.saveSettings = async function () {
    await originalSaveSettings();
    await saveShortcutSettings();
  };
}

// Add methods to SettingsManager prototype for new functionality
SettingsManager.prototype.updateFixedPositionControls = function () {
  const selectedPosition = document.querySelector('input[name="hud-position"]:checked')?.value;
  const fixedControls = this.elements.fixedPositionControls;

  if (selectedPosition === 'fixed') {
    fixedControls.style.display = 'block';
  } else {
    fixedControls.style.display = 'none';
  }
};

SettingsManager.prototype.collectFormData = function () {
  const data = {
    translation: {
      sourceLanguage: this.elements.sourceLanguage.value,
      targetLanguage: this.elements.targetLanguage.value,
    },
    ocr: {
      languages: [],
      confidenceThreshold: parseInt(this.elements.ocrConfidence.value, 10),
      psm: parseInt(this.elements.ocrPsm.value, 10),
    },
    hud: {
      theme: this.elements.hudTheme.value,
      size: {
        width: parseInt(this.elements.hudWidth.value, 10),
        height: parseInt(this.elements.hudHeight.value, 10),
      },
      opacity: parseFloat(this.elements.hudOpacity.value),
      autoHideDuration: parseInt(this.elements.autoHideDuration.value, 10),
      position: document.querySelector('input[name="hud-position"]:checked')?.value || 'mouse',
    },
  };

  // Collect selected OCR languages
  const ocrCheckboxes = this.elements.ocrLanguagesGroup.querySelectorAll(
    'input[type="checkbox"]:checked'
  );
  data.ocr.languages = Array.from(ocrCheckboxes).map((cb) => cb.value);

  // Add fixed position if selected
  if (data.hud.position === 'fixed') {
    data.hud.fixedPosition = {
      x: parseInt(this.elements.hudX.value, 10),
      y: parseInt(this.elements.hudY.value, 10),
    };
  }

  return data;
};
