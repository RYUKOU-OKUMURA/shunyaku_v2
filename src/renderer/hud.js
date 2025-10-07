/**
 * HUD Window Frontend Logic
 * Shunyaku v2 - HUDウィンドウのフロントエンド制御
 */

(function () {
  'use strict';

  // DOM要素の取得
  const elements = {
    closeBtn: document.getElementById('closeBtn'),
    minimizeBtn: document.getElementById('minimizeBtn'),
    pinBtn: document.getElementById('pinBtn'),
    pinBtnIcon: document.getElementById('pinBtnIcon'),
    copyBtn: document.getElementById('copyBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    originalText: document.getElementById('originalText'),
    translatedText: document.getElementById('translatedText'),
    statusText: document.getElementById('statusText'),
    statusIndicator: document.getElementById('statusIndicator'),
    hudContainer: document.getElementById('hudContainer'),

    // 手動翻訳関連の要素（タスク2.5）
    manualInputArea: document.getElementById('manualInputArea'),
    textDisplayArea: document.getElementById('textDisplayArea'),
    actionButtons: document.getElementById('actionButtons'),
    manualTextInput: document.getElementById('manualTextInput'),
    characterCount: document.getElementById('characterCount'),
    targetLanguageSelect: document.getElementById('targetLanguageSelect'),
    translateBtn: document.getElementById('translateBtn'),
    translateBtnIcon: document.getElementById('translateBtnIcon'),
    translateBtnText: document.getElementById('translateBtnText'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorDisplay: document.getElementById('errorDisplay'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    newTranslationBtn: document.getElementById('newTranslationBtn'),
  };

  // 自動非表示機能の状態管理（タスク4.1）
  let isPinnedMode = false;
  let isUserInteracting = false;
  const autoHideCleanupFunctions = [];

  // HUDの初期化
  function initializeHUD() {
    setupEventListeners();
    initializeManualTranslation();
    initializeAutoHide();
    updateStatus('ready', '準備完了');
    // eslint-disable-next-line no-console
    console.log('HUD initialized successfully');
  }

  // 手動翻訳機能の初期化
  function initializeManualTranslation() {
    // 初期状態は入力モード
    showManualInputMode();

    // テキスト入力欄の文字数カウンター初期化
    updateCharacterCount();

    // 翻訳ボタンの状態を初期化
    updateTranslateButtonState();
  }

  // イベントリスナーの設定
  function setupEventListeners() {
    // 閉じるボタン
    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', closeHUD);
    }

    // 最小化ボタン（現在は非表示機能）
    if (elements.minimizeBtn) {
      elements.minimizeBtn.addEventListener('click', minimizeHUD);
    }

    // 固定モードボタン（タスク4.1.4）
    if (elements.pinBtn) {
      elements.pinBtn.addEventListener('click', togglePinnedMode);
    }

    // コピーボタン - 右クリックでオプション表示
    if (elements.copyBtn) {
      elements.copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        copyTranslation('translated');
      });

      // 長押しまたは右クリックでオプション表示
      let pressTimer;
      elements.copyBtn.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
          toggleCopyOptions();
        }, 500);
      });

      elements.copyBtn.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
      });

      elements.copyBtn.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
      });

      elements.copyBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleCopyOptions();
      });
    }

    // 再翻訳ボタン
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', refreshTranslation);
    }

    // 手動翻訳関連のイベントリスナー（タスク2.5）
    setupManualTranslationEventListeners();

    // Escキーで閉じる（タスク1.3.3）
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeHUD();
      }
    });

    // Escキー処理の確実性のため、keyupイベントも追加
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    // ドラッグ可能エリアの設定（既にCSSで設定済みだが、追加の制御）
    setupDragBehavior();

    // ユーザー操作検出の設定（タスク4.1.3）
    setupUserActivityDetection();
  }

  // 手動翻訳のイベントリスナー設定
  function setupManualTranslationEventListeners() {
    // テキスト入力欄の文字数カウンター
    if (elements.manualTextInput) {
      elements.manualTextInput.addEventListener('input', () => {
        updateCharacterCount();
        updateTranslateButtonState();
      });

      // Ctrl+Enterで翻訳実行
      elements.manualTextInput.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          if (!elements.translateBtn.disabled) {
            performTranslation();
          }
        }
      });
    }

    // 翻訳ボタン
    if (elements.translateBtn) {
      elements.translateBtn.addEventListener('click', performTranslation);
    }

    // 再試行ボタン
    if (elements.retryBtn) {
      elements.retryBtn.addEventListener('click', performTranslation);
    }

    // 新規翻訳ボタン
    if (elements.newTranslationBtn) {
      elements.newTranslationBtn.addEventListener('click', showManualInputMode);
    }
  }

  // ドラッグ動作の設定
  function setupDragBehavior() {
    const header = document.getElementById('hudHeader');
    if (!header) {
      return;
    }

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // マウスイベント（将来のフィーチャー用の準備）
    header.addEventListener('mousedown', (e) => {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        // Electronのドラッグ機能に任せる
      }
    });

    document.addEventListener('mouseup', (_e) => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    });
  }

  // HUDを閉じる（タスク1.3.2）
  function closeHUD() {
    updateStatus('closing', '終了中...');

    // Electronメインプロセスに閉じる要求を送信
    if (window.electronAPI && window.electronAPI.closeHUD) {
      window.electronAPI
        .closeHUD()
        .then(() => {
          // eslint-disable-next-line no-console
          console.log('HUD closed successfully');
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to close HUD:', error);
          // フォールバック: 直接ウィンドウを閉じる
          window.close();
        });
    } else {
      // フォールバック: ウィンドウを閉じる
      window.close();
    }
  }

  // HUDを最小化（隠す）
  function minimizeHUD() {
    updateStatus('minimizing', '最小化中...');

    if (window.electronAPI && window.electronAPI.hideHUD) {
      window.electronAPI.hideHUD();
    }
  }

  // 翻訳テキストをクリップボードにコピー（拡張機能付き）
  async function copyTranslation(copyType = 'translated') {
    let textToCopy = '';
    let statusMessage = '';

    switch (copyType) {
      case 'original':
        textToCopy = elements.originalText?.textContent || '';
        statusMessage = '原文をコピー';
        break;
      case 'translated':
        textToCopy = elements.translatedText?.textContent || '';
        statusMessage = '翻訳文をコピー';
        break;
      case 'both': {
        const original = elements.originalText?.textContent || '';
        const translated = elements.translatedText?.textContent || '';
        textToCopy = `原文: ${original}\n\n翻訳: ${translated}`;
        statusMessage = '原文と翻訳をコピー';
        break;
      }
      default:
        textToCopy = elements.translatedText?.textContent || '';
        statusMessage = 'コピー';
    }

    if (!textToCopy.trim()) {
      updateStatus('error', 'コピーするテキストがありません');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
      return;
    }

    try {
      // コピー中の視覚フィードバック
      elements.copyBtn?.classList.add('copying');
      updateStatus('processing', 'コピー中...');

      // Clipboard APIを使用してコピー
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // フォールバック: 選択してコピー
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      updateStatus('ready', `${statusMessage}完了`);

      // 成功時の視覚フィードバック
      elements.copyBtn?.classList.remove('copying');
      elements.copyBtn?.classList.add('success');

      // ボタンテキストを一時的に変更
      const originalText = elements.copyBtn?.querySelector('.btn-text')?.textContent;
      const btnText = elements.copyBtn?.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = '完了!';
      }

      setTimeout(() => {
        elements.copyBtn?.classList.remove('success');
        if (btnText) {
          btnText.textContent = originalText;
        }
        updateStatus('ready', '準備完了');
      }, 1500);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy text:', error);
      elements.copyBtn?.classList.remove('copying');
      updateStatus('error', 'コピーに失敗しました');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
    }
  }

  // コピーオプション表示の切り替え
  function toggleCopyOptions() {
    const copyBtn = elements.copyBtn;
    if (!copyBtn) {
      return;
    }

    let copyOptions = copyBtn.parentElement?.querySelector('.copy-options');

    if (!copyOptions) {
      copyOptions = createCopyOptionsMenu();
      copyBtn.parentElement?.appendChild(copyOptions);
    }

    copyOptions.classList.toggle('show');

    // 外側クリックで閉じる
    const closeCopyOptions = (e) => {
      if (!copyBtn.contains(e.target) && !copyOptions.contains(e.target)) {
        copyOptions.classList.remove('show');
        document.removeEventListener('click', closeCopyOptions);
      }
    };

    if (copyOptions.classList.contains('show')) {
      setTimeout(() => {
        document.addEventListener('click', closeCopyOptions);
      }, 10);
    }
  }

  // コピーオプションメニューの作成
  function createCopyOptionsMenu() {
    const copyOptions = document.createElement('div');
    copyOptions.className = 'copy-options';

    const options = [
      { type: 'translated', icon: '📝', text: '翻訳文のみ' },
      { type: 'original', icon: '📄', text: '原文のみ' },
      { type: 'both', icon: '📋', text: '原文と翻訳' },
    ];

    options.forEach((option) => {
      const button = document.createElement('button');
      button.className = 'copy-option';
      button.innerHTML = `
        <span class="copy-option-icon">${option.icon}</span>
        <span>${option.text}</span>
      `;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTranslation(option.type);
        copyOptions.classList.remove('show');
      });
      copyOptions.appendChild(button);
    });

    return copyOptions;
  }

  // ステータスを更新
  function updateStatus(status, message) {
    if (elements.statusText) {
      elements.statusText.textContent = message;
    }

    if (elements.statusIndicator) {
      // すべてのステータスクラスを削除
      elements.statusIndicator.className = 'indicator-dot';

      // 新しいステータスクラスを追加
      elements.statusIndicator.classList.add(status);
    }
  }

  // テキストコンテンツを更新（外部から呼び出し用）
  function updateTextContent(originalText, translatedText) {
    if (elements.originalText && originalText) {
      elements.originalText.textContent = originalText;
    }

    if (elements.translatedText && translatedText) {
      elements.translatedText.textContent = translatedText;
    }

    updateStatus('ready', '更新完了');
  }

  // 手動翻訳機能の実装（タスク2.5）

  // 文字数カウンターを更新
  function updateCharacterCount() {
    if (!elements.manualTextInput || !elements.characterCount) {
      return;
    }

    const text = elements.manualTextInput.value;
    const count = text.length;
    const maxLength = 5000;

    elements.characterCount.textContent = count;

    // 文字数に応じて色を変更
    const counter = elements.characterCount.parentElement;
    counter.classList.remove('warning', 'limit');

    if (count > maxLength * 0.9) {
      counter.classList.add('limit');
    } else if (count > maxLength * 0.8) {
      counter.classList.add('warning');
    }
  }

  // 翻訳ボタンの状態を更新
  function updateTranslateButtonState() {
    if (!elements.translateBtn || !elements.manualTextInput) {
      return;
    }

    const text = elements.manualTextInput.value.trim();
    const hasText = text.length > 0;

    elements.translateBtn.disabled = !hasText;

    if (hasText) {
      elements.translateBtnIcon.textContent = '🔄';
      elements.translateBtnText.textContent = '翻訳';
    } else {
      elements.translateBtnIcon.textContent = '🔄';
      elements.translateBtnText.textContent = '翻訳';
    }
  }

  // 翻訳を実行
  async function performTranslation() {
    if (!elements.manualTextInput || !elements.targetLanguageSelect) {
      return;
    }

    const text = elements.manualTextInput.value.trim();
    const targetLanguage = elements.targetLanguageSelect.value;

    if (!text) {
      showError('翻訳するテキストを入力してください。');
      return;
    }

    try {
      // ローディング状態を表示
      showLoadingState();
      updateStatus('processing', '翻訳中...');

      // 翻訳APIを呼び出し
      const response = await window.electronAPI.translateText(text, targetLanguage);

      if (response.success) {
        // 翻訳成功
        showTranslationResult(response.result);
        updateStatus('ready', '翻訳完了');
      } else {
        // 翻訳失敗
        showError(response.error || '翻訳に失敗しました。', response.errorType);
        updateStatus('error', 'エラーが発生しました');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Translation error:', error);
      showError('翻訳処理中にエラーが発生しました。');
      updateStatus('error', 'エラーが発生しました');
    }
  }

  // 手動入力モードを表示
  function showManualInputMode() {
    if (elements.manualInputArea) {
      elements.manualInputArea.style.display = 'flex';
    }
    if (elements.textDisplayArea) {
      elements.textDisplayArea.style.display = 'none';
    }
    if (elements.actionButtons) {
      elements.actionButtons.style.display = 'none';
    }

    // 入力欄をクリア
    if (elements.manualTextInput) {
      elements.manualTextInput.value = '';
      elements.manualTextInput.focus();
    }

    updateCharacterCount();
    updateTranslateButtonState();
    hideError();
    updateStatus('ready', 'テキストを入力してください');
  }

  // ローディング状態を表示（拡張機能付き）
  function showLoadingState(stage = 'translating') {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = 'flex';

      // 既存のローディングコンテンツを更新
      const loadingText = elements.loadingIndicator.querySelector('.loading-text');
      const spinner = elements.loadingIndicator.querySelector('.loading-spinner');

      // ステージ別のローディングメッセージ
      const stageMessages = {
        capturing: 'スクリーンキャプチャ中...',
        ocr: 'テキスト認識中...',
        translating: '翻訳中...',
        processing: '処理中...',
      };

      if (loadingText) {
        loadingText.textContent = stageMessages[stage] || '処理中...';
      }

      // 高度なスピナーを追加
      if (spinner && !spinner.classList.contains('advanced-spinner')) {
        spinner.className = 'advanced-spinner';
      }

      // プログレスバーを追加
      addLoadingProgress(stage);
    }

    if (elements.translateBtn) {
      elements.translateBtn.disabled = true;
      elements.translateBtnIcon.textContent = '⟳';
      elements.translateBtnText.textContent = '処理中...';
    }

    hideError();
  }

  // ローディングプログレスを追加
  function addLoadingProgress(stage) {
    const loadingIndicator = elements.loadingIndicator;
    if (!loadingIndicator) {
      return;
    }

    let progressContainer = loadingIndicator.querySelector('.loading-progress');
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.className = 'loading-progress';

      const loadingStage = document.createElement('div');
      loadingStage.className = 'loading-stage';

      const loadingBar = document.createElement('div');
      loadingBar.className = 'loading-bar';
      const loadingBarFill = document.createElement('div');
      loadingBarFill.className = 'loading-bar-fill';
      loadingBar.appendChild(loadingBarFill);

      const loadingDots = document.createElement('div');
      loadingDots.className = 'loading-dots';
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'loading-dot';
        loadingDots.appendChild(dot);
      }

      progressContainer.appendChild(loadingStage);
      progressContainer.appendChild(loadingBar);
      progressContainer.appendChild(loadingDots);

      loadingIndicator.appendChild(progressContainer);
    }

    const loadingStage = progressContainer.querySelector('.loading-stage');
    if (loadingStage) {
      const stageTexts = {
        capturing: 'キャプチャ実行中',
        ocr: 'テキスト解析中',
        translating: 'AI翻訳実行中',
        processing: 'データ処理中',
      };
      loadingStage.textContent = stageTexts[stage] || '処理実行中';
    }
  }

  // 翻訳結果を表示（拡張機能付き）
  function showTranslationResult(result) {
    // 入力モードを非表示
    if (elements.manualInputArea) {
      elements.manualInputArea.style.display = 'none';
    }

    // 結果表示エリアを表示
    if (elements.textDisplayArea) {
      elements.textDisplayArea.style.display = 'flex';
    }
    if (elements.actionButtons) {
      elements.actionButtons.style.display = 'flex';
    }

    // テキスト内容を更新
    if (elements.originalText) {
      elements.originalText.textContent = result.originalText;
      updateTextStyling(elements.originalText, result.originalText);
      addLanguageIndicator(elements.originalText.parentElement, result.sourceLanguage || 'auto');
    }
    if (elements.translatedText) {
      elements.translatedText.textContent = result.translatedText;
      updateTextStyling(elements.translatedText, result.translatedText);
      addLanguageIndicator(elements.translatedText.parentElement, result.targetLanguage || 'ja');
    }

    hideLoading();
    hideError();
  }

  // テキストの長さに応じてスタイリングを調整
  function updateTextStyling(element, text) {
    if (!element || !text) {
      return;
    }

    element.classList.remove('short-text', 'long-text');

    if (text.length > 200) {
      element.classList.add('long-text');
    } else {
      element.classList.add('short-text');
    }
  }

  // 言語インジケーターを追加
  function addLanguageIndicator(parentElement, language) {
    if (!parentElement || !language) {
      return;
    }

    // 既存のインジケーターを削除
    const existingIndicator = parentElement.querySelector('.language-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // 新しいインジケーターを作成
    const indicator = document.createElement('div');
    indicator.className = 'language-indicator';
    indicator.textContent = formatLanguageCode(language);
    parentElement.appendChild(indicator);
  }

  // 言語コードを表示用にフォーマット
  function formatLanguageCode(code) {
    const languageNames = {
      ja: 'JA',
      en: 'EN',
      zh: 'ZH',
      ko: 'KO',
      de: 'DE',
      fr: 'FR',
      es: 'ES',
      auto: 'AUTO',
    };
    return languageNames[code] || code.toUpperCase();
  }

  // エラーを表示（拡張機能付き）
  function showError(message, errorType = null, errorDetails = null) {
    if (!elements.errorDisplay || !elements.errorMessage) {
      return;
    }

    let displayMessage = message;
    let errorClass = 'error-error'; // デフォルトエラー

    // エラー種別に応じてユーザーフレンドリーなメッセージに変換
    if (errorType) {
      switch (errorType) {
        case 'api_key':
          displayMessage =
            'APIキーが設定されていないか、無効です。設定画面でAPIキーを確認してください。';
          errorClass = 'error-warning';
          break;
        case 'quota_exceeded':
          displayMessage =
            'API使用量の上限に達しました。しばらく時間をおいてから再試行してください。';
          errorClass = 'error-warning';
          break;
        case 'network':
          displayMessage = 'ネットワークエラーです。インターネット接続を確認してください。';
          errorClass = 'error-error';
          break;
        case 'validation':
          displayMessage = '入力テキストに問題があります。内容を確認してください。';
          errorClass = 'error-info';
          break;
        case 'ocr_failed':
          displayMessage =
            'テキスト認識に失敗しました。画像が不鮮明または文字が小さすぎる可能性があります。';
          errorClass = 'error-warning';
          break;
        case 'capture_failed':
          displayMessage = 'スクリーンキャプチャに失敗しました。権限設定を確認してください。';
          errorClass = 'error-error';
          break;
      }
    }

    // エラー表示の内容を構築
    rebuildErrorDisplay(displayMessage, errorDetails, errorClass, errorType);

    elements.errorDisplay.style.display = 'flex';
    hideLoading();
  }

  // エラー表示を再構築
  function rebuildErrorDisplay(message, details, errorClass, errorType) {
    const errorDisplay = elements.errorDisplay;
    if (!errorDisplay) {
      return;
    }

    // クラスをリセットして新しいクラスを適用
    errorDisplay.className = `error-display ${errorClass}`;

    // エラーアイコンを更新
    const errorIcon = errorDisplay.querySelector('.error-icon');
    if (errorIcon) {
      const icons = {
        'error-error': '⚠️',
        'error-warning': '⚡',
        'error-info': 'ℹ️',
      };
      errorIcon.textContent = icons[errorClass] || '⚠️';
    }

    // エラーメッセージを更新
    let errorContent = errorDisplay.querySelector('.error-content');
    if (!errorContent) {
      errorContent = document.createElement('div');
      errorContent.className = 'error-content';
      errorDisplay.appendChild(errorContent);
    }

    errorContent.innerHTML = `
      <div class="error-message">${message}</div>
      ${details ? `<div class="error-details">${details}</div>` : ''}
      <div class="error-actions">
        <button class="retry-btn" onclick="handleErrorRetry('${errorType || 'unknown'}')">
          <span>🔄</span> 再試行
        </button>
        <button class="dismiss-error-btn" onclick="hideError()">
          <span>✕</span> 閉じる
        </button>
      </div>
    `;
  }

  // エラーリトライの処理
  function handleErrorRetry(errorType) {
    hideError();

    switch (errorType) {
      case 'api_key':
        // 設定画面を開く
        if (window.electronAPI && window.electronAPI.openSettings) {
          window.electronAPI.openSettings();
        }
        break;
      case 'network':
      case 'quota_exceeded':
      case 'validation':
        // 前回の翻訳を再実行
        refreshTranslation();
        break;
      case 'ocr_failed':
      case 'capture_failed':
        // 完全フローを再実行
        if (window.HUD && window.HUD.executeFullWorkflow) {
          window.HUD.executeFullWorkflow();
        }
        break;
      default:
        // デフォルトの再試行
        if (elements.originalText?.textContent) {
          refreshTranslation();
        } else {
          showManualInputMode();
        }
    }
  }

  // エラー表示を非表示
  function hideError() {
    if (elements.errorDisplay) {
      elements.errorDisplay.style.display = 'none';
    }
  }

  // ローディング表示を非表示
  function hideLoading() {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = 'none';
    }
    if (elements.translateBtn) {
      elements.translateBtn.disabled = false;
      elements.translateBtnIcon.textContent = '🔄';
      elements.translateBtnText.textContent = '翻訳';
    }
  }

  // 再翻訳を実行（拡張機能付き）
  async function refreshTranslation() {
    const originalText = elements.originalText?.textContent || '';
    if (!originalText.trim()) {
      updateStatus('error', '再翻訳する原文がありません');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
      return;
    }

    try {
      // 再翻訳中の視覚フィードバック
      elements.refreshBtn?.classList.add('refreshing');
      const btnText = elements.refreshBtn?.querySelector('.btn-text');

      if (btnText) {
        btnText.textContent = '再翻訳中...';
      }

      updateStatus('processing', '再翻訳中...');

      // 現在の言語設定を取得
      const targetLanguage = elements.targetLanguageSelect?.value || 'ja';

      // 翻訳APIを直接呼び出し
      const response = await window.electronAPI.translateText(originalText, targetLanguage);

      if (response.success) {
        // 翻訳結果を更新
        if (elements.translatedText) {
          // アニメーション付きで更新
          elements.translatedText.style.opacity = '0.5';
          setTimeout(() => {
            elements.translatedText.textContent = response.result.translatedText;
            elements.translatedText.style.opacity = '1';
          }, 200);
        }

        updateStatus('ready', '再翻訳完了');
      } else {
        showError(response.error || '再翻訳に失敗しました', response.errorType);
        updateStatus('error', '再翻訳エラー');
      }
    } catch (error) {
      console.error('Refresh translation error:', error);
      showError('再翻訳処理中にエラーが発生しました');
      updateStatus('error', '再翻訳エラー');
    } finally {
      // 視覚フィードバックをリセット
      elements.refreshBtn?.classList.remove('refreshing');
      const btnText = elements.refreshBtn?.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = '再翻訳';
      }

      setTimeout(() => {
        if (
          elements.statusText?.textContent.includes('完了') ||
          elements.statusText?.textContent.includes('エラー')
        ) {
          updateStatus('ready', '準備完了');
        }
      }, 2000);
    }
  }

  // 完全フロー用の翻訳結果表示（タスク3.4用）
  function updateTranslationDisplay(translationData) {
    try {
      // 入力モードを非表示
      if (elements.manualInputArea) {
        elements.manualInputArea.style.display = 'none';
      }

      // 結果表示エリアを表示
      if (elements.textDisplayArea) {
        elements.textDisplayArea.style.display = 'flex';
      }
      if (elements.actionButtons) {
        elements.actionButtons.style.display = 'flex';
      }

      // テキスト内容を更新
      if (elements.originalText && translationData.originalText) {
        elements.originalText.textContent = translationData.originalText;
      }
      if (elements.translatedText && translationData.translatedText) {
        elements.translatedText.textContent = translationData.translatedText;
      }

      // ステータスを更新
      const confidence = translationData.confidence || 0;
      const languageInfo = `${translationData.sourceLanguage || 'auto'} → ${translationData.targetLanguage || 'ja'}`;
      updateStatus('ready', `翻訳完了 (${languageInfo}, 信頼度: ${confidence}%)`);

      hideLoading();
      hideError();

      console.log('Translation display updated successfully:', translationData);
    } catch (error) {
      console.error('Failed to update translation display:', error);
      showError('翻訳結果の表示に失敗しました');
    }
  }

  // エラー表示の更新（タスク3.4用）
  function updateErrorDisplay(errorData) {
    try {
      // 入力モードを非表示
      if (elements.manualInputArea) {
        elements.manualInputArea.style.display = 'none';
      }

      // エラーを表示
      showError(errorData.error || '不明なエラーが発生しました');

      const phase = errorData.phase || 'unknown';
      updateStatus('error', `エラー発生: ${phase}フェーズ`);

      console.log('Error display updated:', errorData);
    } catch (error) {
      console.error('Failed to update error display:', error);
    }
  }

  // ワークフロー実行の開始
  async function executeFullWorkflow() {
    try {
      updateStatus('processing', '完全フロー実行中...');
      // showLoading(); // 暂定的にコメントアウト

      const result = await window.electronAPI.executeFullWorkflow({
        triggerMethod: 'manual',
      });

      if (result.success) {
        updateTranslationDisplay({
          originalText: result.result.original,
          translatedText: result.result.translated,
          sourceLanguage: result.result.sourceLanguage,
          targetLanguage: result.result.targetLanguage,
          confidence: result.result.confidence,
        });
      } else {
        updateErrorDisplay({
          error: result.error,
          phase: result.phase,
        });
      }
    } catch (error) {
      console.error('Full workflow execution failed:', error);
      updateErrorDisplay({
        error: 'ワークフローの実行に失敗しました',
        phase: 'execution',
      });
    }
  }

  // 自動非表示機能の初期化（タスク4.1）
  function initializeAutoHide() {
    // メインプロセスからのイベントリスナーを設定
    if (window.electronAPI) {
      // 自動非表示の事前通知
      const removeAutoHidingListener = window.electronAPI.onHudAutoHiding(() => {
        showAutoHideWarning();
      });
      autoHideCleanupFunctions.push(removeAutoHidingListener);

      // 固定モードの変更通知
      const removePinnedListener = window.electronAPI.onHudPinnedModeChanged((event, pinned) => {
        updatePinnedModeUI(pinned);
      });
      autoHideCleanupFunctions.push(removePinnedListener);

      // ユーザー活動の通知
      const removeActivityListener = window.electronAPI.onHudUserActivity(() => {
        hideAutoHideWarning();
      });
      autoHideCleanupFunctions.push(removeActivityListener);
    }
  }

  // 固定モードの切り替え（タスク4.1.4）
  async function togglePinnedMode() {
    try {
      const result = await window.electronAPI.toggleHUDPinned();
      if (result.success) {
        isPinnedMode = result.pinned;
        updatePinnedModeUI(result.pinned);
        updateStatus('ready', isPinnedMode ? '固定モード有効' : '固定モード無効');
      }
    } catch (error) {
      console.error('Failed to toggle pinned mode:', error);
    }
  }

  // 固定モードUIの更新
  function updatePinnedModeUI(pinned) {
    isPinnedMode = pinned;

    if (elements.pinBtn && elements.pinBtnIcon) {
      if (pinned) {
        elements.pinBtn.classList.add('pinned');
        elements.pinBtn.title = '固定解除';
        elements.pinBtnIcon.textContent = '📌';
      } else {
        elements.pinBtn.classList.remove('pinned');
        elements.pinBtn.title = '固定モード';
        elements.pinBtnIcon.textContent = '📍';
      }
    }

    // 固定モード時は自動非表示警告を非表示
    if (pinned) {
      hideAutoHideWarning();
    }
  }

  // ユーザー操作検出の設定（タスク4.1.3）
  function setupUserActivityDetection() {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart'];
    const hudContainer = elements.hudContainer || document.body;

    const activityHandler = () => {
      if (!isUserInteracting) {
        isUserInteracting = true;
        // メインプロセスにユーザー操作を通知
        if (window.electronAPI) {
          window.electronAPI.notifyUserActivity();
        }

        // 500ms後にフラグをリセット（デバウンス）
        setTimeout(() => {
          isUserInteracting = false;
        }, 500);
      }
    };

    // 各イベントリスナーを設定
    activityEvents.forEach((eventType) => {
      hudContainer.addEventListener(eventType, activityHandler, { passive: true });
    });
  }

  // 自動非表示警告の表示
  function showAutoHideWarning() {
    if (isPinnedMode) {
      return;
    } // 固定モード時は表示しない

    let warningElement = document.getElementById('autoHideWarning');
    if (!warningElement) {
      warningElement = document.createElement('div');
      warningElement.id = 'autoHideWarning';
      warningElement.className = 'auto-hide-warning';
      warningElement.innerHTML = `
        <div class="warning-content">
          <span class="warning-icon">⏰</span>
          <span class="warning-text">あと1秒で自動で閉じます</span>
        </div>
      `;

      // HUDコンテナの上部に追加
      const hudContainer = elements.hudContainer || document.body;
      hudContainer.appendChild(warningElement);
    }

    // アニメーションで表示
    setTimeout(() => {
      if (warningElement) {
        warningElement.style.opacity = '1';
        warningElement.style.transform = 'translateY(0)';
      }
    }, 10);
  }

  // 自動非表示警告の非表示
  function hideAutoHideWarning() {
    const warningElement = document.getElementById('autoHideWarning');
    if (warningElement) {
      warningElement.style.opacity = '0';
      warningElement.style.transform = 'translateY(-10px)';

      setTimeout(() => {
        if (warningElement.parentNode) {
          warningElement.parentNode.removeChild(warningElement);
        }
      }, 300);
    }
  }

  // リソースのクリーンアップ
  function cleanupAutoHide() {
    // イベントリスナーを清理
    autoHideCleanupFunctions.forEach((cleanup) => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
    autoHideCleanupFunctions.length = 0;

    // 警告を非表示
    hideAutoHideWarning();
  }

  // 外部から呼び出し可能な関数をグローバルに公開
  window.HUD = {
    updateTextContent,
    updateStatus,
    copyTranslation,
    refreshTranslation,
    close: closeHUD,
    minimize: minimizeHUD,
    showManualInputMode,
    performTranslation,
    executeFullWorkflow,
    togglePinnedMode,
    isPinned: () => isPinnedMode,
    cleanup: cleanupAutoHide,
  };

  // タスク3.4用のグローバル関数
  window.updateTranslationDisplay = updateTranslationDisplay;
  window.updateErrorDisplay = updateErrorDisplay;

  // タスク3.5用のグローバル関数
  window.handleErrorRetry = handleErrorRetry;
  window.hideError = hideError;
  window.copyTranslation = copyTranslation;
  window.showError = showError;
  window.showLoadingState = showLoadingState;
  window.hideLoading = hideLoading;
  window.refreshTranslation = refreshTranslation;
  window.updateTextStyling = updateTextStyling;
  window.addLanguageIndicator = addLanguageIndicator;
  window.formatLanguageCode = formatLanguageCode;
  window.createCopyOptionsMenu = createCopyOptionsMenu;
  window.showTranslationResult = showTranslationResult;

  // DOMが読み込まれたら初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHUD);
  } else {
    initializeHUD();
  }
})();
