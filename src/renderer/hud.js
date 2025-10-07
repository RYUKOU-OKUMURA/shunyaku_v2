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

    // API制限エラー関連の要素（タスク4.4.1）
    apiLimitNotice: document.getElementById('apiLimitNotice'),
    limitTitle: document.getElementById('limitTitle'),
    limitMessage: document.getElementById('limitMessage'),
    limitAlternatives: document.getElementById('limitAlternatives'),
    alternativesList: document.getElementById('alternativesList'),
    usageCheckBtn: document.getElementById('usageCheckBtn'),
    apiSettingsBtn: document.getElementById('apiSettingsBtn'),

    // OCR失敗時のフォールバック要素（タスク4.4.2）
    ocrFallbackNotice: document.getElementById('ocrFallbackNotice'),

    // ネットワーク状態関連の要素（タスク4.4.3）
    networkIndicator: document.getElementById('networkIndicator'),
    networkIcon: document.getElementById('networkIcon'),
    offlineNotice: document.getElementById('offlineNotice'),
  };

  // 自動非表示機能の状態管理（タスク4.1）
  let isPinnedMode = false;
  let isUserInteracting = false;
  const autoHideCleanupFunctions = [];

  // ネットワーク状態管理（タスク4.4.3）
  const networkStatus = {
    isOnline: navigator.onLine || true,
    lastChecked: Date.now(),
    checkInProgress: false,
  };

  // エラーリカバリ状態管理（タスク4.4）
  const errorRecoveryState = {
    lastError: null,
    errorType: null,
    retryCount: 0,
    maxRetries: 3,
    canRetry: false,
    lastTranslationRequest: null,
  };

  // HUDの初期化
  function initializeHUD() {
    setupEventListeners();
    initializeManualTranslation();
    initializeAutoHide();
    initializeNetworkMonitoring(); // タスク4.4.3
    initializeErrorRecovery(); // タスク4.4
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

    // ネットワーク状態をチェック（タスク4.4.3）
    if (!networkStatus.isOnline && !navigator.onLine) {
      showError(
        'インターネット接続がありません。翻訳機能を使用するにはネットワーク接続が必要です。',
        'network',
        null,
        {
          alternatives: [
            'Wi-Fiまたは有線接続を確認してください',
            'モバイルデータ接続を確認してください',
            'ネットワーク設定を確認してください',
            '接続復旧後に再試行してください',
          ],
          severity: 'error',
        },
      );
      return;
    }

    try {
      // ローディング状態を表示
      showLoadingState();
      updateStatus('processing', '翻訳中...');

      // 翻訳APIを呼び出し
      const response = await window.electronAPI.translateText(text, targetLanguage);

      if (response.success) {
        // 翻訳成功 - 再試行統計を更新
        updateRetryStats('translation_success', true);
        showTranslationResult(response.result);
        updateStatus('ready', '翻訳完了');
      } else {
        // 翻訳失敗 - 詳細エラーデータがある場合はそれを使用
        const errorData = response.errorData || null;

        // 再試行統計を更新
        updateRetryStats(response.errorType || 'unknown', false);

        // ネットワークエラーの場合は特別処理
        if (response.errorType === 'network') {
          // ネットワーク状態を再チェック
          const isOnline = await checkNetworkConnection();
          if (!isOnline) {
            showOfflineNotice();
          }
        }

        showError(response.error || '翻訳に失敗しました。', response.errorType, null, errorData);
        updateStatus('error', 'エラーが発生しました');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Translation error:', error);

      // ネットワークエラーの可能性をチェック
      const errorMessage = error.message?.toLowerCase() || '';
      if (
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout')
      ) {
        checkNetworkConnection();
        showError('ネットワークエラーが発生しました。接続を確認してください。', 'network');
      } else {
        showError('翻訳処理中にエラーが発生しました。');
      }
      updateStatus('error', 'エラーが発生しました');
    }
  }

  // 手動入力モードを表示
  function showManualInputMode(clearInput = true) {
    if (elements.manualInputArea) {
      elements.manualInputArea.style.display = 'flex';
    }
    if (elements.textDisplayArea) {
      elements.textDisplayArea.style.display = 'none';
    }
    if (elements.actionButtons) {
      elements.actionButtons.style.display = 'none';
    }

    // 入力欄をクリア（オプション）
    if (clearInput && elements.manualTextInput) {
      elements.manualTextInput.value = '';
    }

    // フォーカスを当てる
    if (elements.manualTextInput) {
      setTimeout(() => {
        elements.manualTextInput.focus();
      }, 100);
    }

    updateCharacterCount();
    updateTranslateButtonState();
    hideError();

    // OCRフォールバック通知が表示されていない場合のみステータス更新
    if (!elements.ocrFallbackNotice || elements.ocrFallbackNotice.style.display === 'none') {
      updateStatus('ready', 'テキストを入力してください');
    }
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
  function showError(message, errorType = null, errorDetails = null, errorData = null) {
    if (!elements.errorDisplay || !elements.errorMessage) {
      return;
    }

    let displayMessage = message;
    let errorClass = 'error-error'; // デフォルトエラー
    let alternatives = [];

    // 詳細なエラーデータがある場合（タスク4.4.1）
    if (errorData && errorData.alternatives) {
      alternatives = errorData.alternatives;
      if (errorData.severity === 'warning') {
        errorClass = 'error-warning';
      } else if (errorData.severity === 'info') {
        errorClass = 'error-info';
      }
    } else if (errorType) {
      // 従来のエラー種別に応じた処理
      switch (errorType) {
      case 'auth':
      case 'api_key':
        displayMessage =
            'APIキーが設定されていないか、無効です。設定画面でAPIキーを確認してください。';
        errorClass = 'error-warning';
        alternatives = [
          '設定画面でAPIキーを再確認してください',
          'DeepL公式サイトでAPIキーの有効性を確認してください',
        ];
        break;
      case 'rate_limit':
        displayMessage =
            'APIリクエスト制限に達しました。少し時間をおいてから再試行してください。';
        errorClass = 'error-warning';
        alternatives = [
          '30秒〜1分待ってから再試行してください',
          'より短いテキストに分割して翻訳してください',
        ];
        break;
      case 'quota_exceeded':
        displayMessage =
            'API使用量の上限に達しました。来月まで待つか、プランのアップグレードを検討してください。';
        errorClass = 'error-error';
        alternatives = [
          '来月まで待つか、DeepL Proプランにアップグレードしてください',
          '他の翻訳サービスの利用を検討してください',
        ];
        break;
      case 'network':
        displayMessage = 'ネットワークエラーです。インターネット接続を確認してください。';
        errorClass = 'error-error';
        alternatives = [
          'インターネット接続を確認してください',
          'VPNやプロキシ設定を確認してください',
          'しばらく待ってから再試行してください',
        ];
        break;
      case 'server_error':
        displayMessage = 'DeepL APIサーバーでエラーが発生しています。';
        errorClass = 'error-warning';
        alternatives = [
          '数分待ってから再試行してください',
          'DeepLの公式ステータスページを確認してください',
        ];
        break;
      case 'validation':
        displayMessage = '入力テキストに問題があります。内容を確認してください。';
        errorClass = 'error-info';
        alternatives = [
          'テキストの内容を確認してください（特殊文字、長さなど）',
          'より短いテキストに分割して試してください',
        ];
        break;
      case 'ocr_failed':
        displayMessage =
            'テキスト認識に失敗しました。画像が不鮮明または文字が小さすぎる可能性があります。';
        errorClass = 'error-warning';
        alternatives = ['画像の解像度を上げてみてください', '手動でテキストを入力してください'];
        break;
      case 'capture_failed':
        displayMessage = 'スクリーンキャプチャに失敗しました。権限設定を確認してください。';
        errorClass = 'error-error';
        alternatives = [
          'システム環境設定で画面録画権限を許可してください',
          '手動でテキストを入力してください',
        ];
        break;
      }
    }

    // エラー表示の内容を構築
    rebuildErrorDisplay(displayMessage, errorDetails, errorClass, errorType, alternatives);

    elements.errorDisplay.style.display = 'flex';
    hideLoading();
  }

  // エラー表示を再構築
  function rebuildErrorDisplay(message, details, errorClass, errorType, alternatives = []) {
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

    // 代替案のHTMLを生成
    let alternativesHTML = '';
    if (alternatives.length > 0) {
      alternativesHTML = `
        <div class="error-alternatives">
          <div class="alternatives-title">💡 解決方法:</div>
          <ul class="alternatives-list">
            ${alternatives.map((alt) => `<li>${alt}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // 再試行ボタンの表示制御
    const showRetryBtn = !['quota_exceeded'].includes(errorType);

    errorContent.innerHTML = `
      <div class="error-message">${message}</div>
      ${details ? `<div class="error-details">${details}</div>` : ''}
      ${alternativesHTML}
      <div class="error-actions">
        ${
  showRetryBtn
    ? `
          <button class="retry-btn" onclick="handleErrorRetry('${errorType || 'unknown'}')">
            <span>🔄</span> 再試行
          </button>
        `
    : ''
  }
        ${
  errorType === 'auth' || errorType === 'api_key'
    ? `
          <button class="settings-btn" onclick="handleOpenSettings()">
            <span>⚙️</span> 設定を開く
          </button>
        `
    : ''
  }
        ${
  ['ocr_failed', 'capture_failed'].includes(errorType)
    ? `
          <button class="manual-input-btn" onclick="handleManualInputFallback()">
            <span>✏️</span> 手動入力
          </button>
        `
    : ''
  }
        <button class="dismiss-error-btn" onclick="hideError()">
          <span>✕</span> 閉じる
        </button>
      </div>
    `;
  }

  // エラーリトライの処理（タスク4.4.4で強化）
  function handleErrorRetry(errorType) {
    hideError();

    // 再試行前の共通処理
    updateStatus('processing', '再試行を準備中...');

    switch (errorType) {
    case 'auth':
    case 'api_key':
      // 設定画面を開く
      handleOpenSettings();
      break;

    case 'rate_limit':
      // API制限エラー - 適切な待機時間後に再試行
      showRetryCountdown(30, '短期制限解除を待機中...', () => {
        refreshTranslation();
      });
      break;

    case 'server_error':
      // サーバーエラー - 短い待機時間後に再試行
      showRetryCountdown(5, 'サーバー回復を待機中...', () => {
        refreshTranslation();
      });
      break;

    case 'network':
      // ネットワークエラー - 接続確認後に再試行
      performNetworkRetry();
      break;

    case 'validation':
      // バリデーションエラー - そのまま再実行
      setTimeout(() => {
        refreshTranslation();
      }, 500);
      break;

    case 'ocr_failed':
      // OCRエラー - 完全フロー再実行または手動入力フォールバック
      performOCRRetry();
      break;

    case 'capture_failed':
      // キャプチャエラー - 完全フロー再実行
      performCaptureRetry();
      break;

    case 'file_not_found':
    case 'file_too_large':
    case 'unsupported_format':
      // ファイル関連エラー - 新しいキャプチャが必要
      performCaptureRetry();
      break;

    case 'memory_error':
      // メモリエラー - 少し待ってからシンプルな再試行
      showRetryCountdown(10, 'システム回復を待機中...', () => {
        refreshTranslation();
      });
      break;

    case 'timeout':
      // タイムアウト - 少し待ってから再試行
      showRetryCountdown(3, 'タイムアウト回復を待機中...', () => {
        refreshTranslation();
      });
      break;

    case 'quota_exceeded':
      // 月間制限の場合は再試行しない
      updateStatus('error', 'プランアップグレードまたは来月まで待機してください');
      setTimeout(() => {
        updateStatus('ready', '準備完了');
      }, 3000);
      break;

    default:
      // デフォルトの再試行
      if (elements.originalText?.textContent) {
        setTimeout(() => {
          refreshTranslation();
        }, 500);
      } else {
        showManualInputMode();
      }
    }
  }

  // カウントダウン付き再試行
  function showRetryCountdown(seconds, message, onComplete) {
    let remainingSeconds = seconds;

    const updateCountdown = () => {
      updateStatus('processing', `${message} (${remainingSeconds}秒)`);
      remainingSeconds--;

      if (remainingSeconds >= 0) {
        setTimeout(updateCountdown, 1000);
      } else {
        onComplete();
      }
    };

    updateCountdown();
  }

  // ネットワーク再試行の実行
  async function performNetworkRetry() {
    updateStatus('Checking network connection...', 'info');
    networkStatus.checkInProgress = true;
    updateNetworkIndicator(navigator.onLine);

    // ネットワーク接続をテスト
    checkNetworkConnection()
      .then((isOnline) => {
        networkStatus.isOnline = isOnline;
        networkStatus.checkInProgress = false;
        updateNetworkIndicator(isOnline);

        if (isOnline) {
          showOfflineNotice(false);
          updateStatus('Connection restored', 'success');

          // 最後の翻訳リクエストがあれば再実行
          if (errorRecoveryState.lastTranslationRequest) {
            performTranslationRetry();
          }
        } else {
          updateStatus('Still offline - check your connection', 'warning');
        }
      })
      .catch((error) => {
        networkStatus.checkInProgress = false;
        updateNetworkIndicator(false);
        updateStatus('Network check failed', 'error');
        console.error('Network retry failed:', error);
      });
  }

  // OCR再試行の実行
  function performOCRRetry() {
    // 完全フローがあるかチェック
    if (window.HUD && window.HUD.executeFullWorkflow) {
      updateStatus('processing', 'OCR処理を再試行中...');
      setTimeout(() => {
        window.HUD.executeFullWorkflow();
      }, 1000);
    } else {
      // フォールバック: 手動入力モード
      updateStatus('processing', '手動入力モードに切り替え中...');
      setTimeout(() => {
        showOCRFallbackMode();
      }, 1000);
    }
  }

  // キャプチャ再試行の実行
  function performCaptureRetry() {
    if (window.HUD && window.HUD.executeFullWorkflow) {
      updateStatus('processing', '新しいスクリーンキャプチャを実行中...');
      setTimeout(() => {
        window.HUD.executeFullWorkflow();
      }, 1000);
    } else {
      updateStatus('error', 'キャプチャ機能が利用できません');
      setTimeout(() => {
        handleManualInputFallback(true);
      }, 2000);
    }
  }

  // 再試行統計（デバッグ用）
  const retryStats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    errorTypes: {},
  };

  // 再試行統計を更新
  function updateRetryStats(errorType, success = false) {
    retryStats.totalRetries++;
    if (success) {
      retryStats.successfulRetries++;
    } else {
      retryStats.failedRetries++;
    }

    if (!retryStats.errorTypes[errorType]) {
      retryStats.errorTypes[errorType] = 0;
    }
    retryStats.errorTypes[errorType]++;

    console.log('Retry stats:', retryStats);
  }

  // 再試行統計を取得
  function getRetryStats() {
    return { ...retryStats };
  }

  // 設定画面を開く
  function handleOpenSettings() {
    if (window.electronAPI && window.electronAPI.openSettings) {
      window.electronAPI.openSettings();
    } else {
      updateStatus('error', '設定画面を開けませんでした');
    }
  }

  // 手動入力フォールバック（タスク4.4.2用）
  function handleManualInputFallback(showNotice = true) {
    hideError();
    showManualInputMode();

    // OCRフォールバック通知を表示
    if (showNotice && elements.ocrFallbackNotice) {
      elements.ocrFallbackNotice.style.display = 'flex';

      // 5秒後に自動で非表示
      setTimeout(() => {
        if (elements.ocrFallbackNotice) {
          elements.ocrFallbackNotice.style.display = 'none';
        }
      }, 5000);
    }

    updateStatus('ready', '手動でテキストを入力してください');

    // 入力欄にフォーカスを当てる
    if (elements.manualTextInput) {
      setTimeout(() => {
        elements.manualTextInput.focus();
      }, 100);
    }
  }

  // OCRフォールバック専用の表示関数
  function showOCRFallbackMode(errorData = null) {
    console.log('[HUD] Showing OCR fallback mode', errorData);

    // OCRフォールバック通知を表示
    if (elements.ocrFallbackNotice) {
      elements.ocrFallbackNotice.style.display = 'flex';
    }

    // 手動入力エリアを表示して活性化
    if (elements.manualInputArea) {
      elements.manualInputArea.style.display = 'block';
      // フォーカスを入力欄に設定
      if (elements.manualTextInput) {
        setTimeout(() => {
          elements.manualTextInput.focus();
        }, 100);
      }
    }

    // 翻訳結果エリアは隠す
    if (elements.textDisplayArea) {
      elements.textDisplayArea.style.display = 'none';
    }

    // エラー状態を更新
    errorRecoveryState.errorType = 'ocr_failed';
    errorRecoveryState.canRetry = true;
    updateRetryButtonState();

    // ステータス更新
    updateStatus('OCR failed - manual input mode', 'warning');
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
        // 再翻訳成功
        updateRetryStats('refresh_success', true);

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
        // 再翻訳失敗
        updateRetryStats(response.errorType || 'refresh_failed', false);

        const errorData = response.errorData || null;
        showError(response.error || '再翻訳に失敗しました', response.errorType, null, errorData);
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

  // ネットワーク監視の初期化（タスク4.4.3）
  function initializeNetworkMonitoring() {
    // 初期状態を設定
    updateNetworkStatus(navigator.onLine);

    // オンライン/オフラインイベントリスナー
    window.addEventListener('online', () => {
      console.log('Network status: online');
      networkStatus.isOnline = true;
      networkStatus.lastChecked = Date.now();
      updateNetworkStatus(true);
      hideOfflineNotice();
    });

    window.addEventListener('offline', () => {
      console.log('Network status: offline');
      networkStatus.isOnline = false;
      networkStatus.lastChecked = Date.now();
      updateNetworkStatus(false);
      showOfflineNotice();
    });

    // 定期的にネットワーク状態をチェック（5分間隔）
    setInterval(checkNetworkConnection, 5 * 60 * 1000);

    // 初回のネットワーク接続テスト
    setTimeout(checkNetworkConnection, 2000);
  }

  // ネットワーク状態の更新
  function updateNetworkStatus(isOnline, isChecking = false) {
    if (!elements.networkIndicator || !elements.networkIcon) {
      return;
    }

    // クラスをリセット
    elements.networkIndicator.className = 'network-indicator';

    if (isChecking) {
      elements.networkIndicator.classList.add('checking');
      elements.networkIcon.textContent = '⏳';
      elements.networkIndicator.title = 'ネットワーク状態を確認中...';
    } else if (isOnline) {
      elements.networkIndicator.classList.add('online');
      elements.networkIcon.textContent = '📶';
      elements.networkIndicator.title = 'オンライン - インターネット接続あり';
    } else {
      elements.networkIndicator.classList.add('offline');
      elements.networkIcon.textContent = '📵';
      elements.networkIndicator.title = 'オフライン - インターネット接続なし';
    }
  }

  // ネットワーク接続をテスト
  async function checkNetworkConnection() {
    if (networkStatus.checkInProgress) {
      return;
    }

    networkStatus.checkInProgress = true;
    updateNetworkStatus(networkStatus.isOnline, true);

    try {
      // 複数のエンドポイントでテスト
      const testUrls = [
        'https://www.google.com/favicon.ico',
        'https://api.deepl.com/v2/languages?auth_key=test', // DeepL API（認証は失敗するが接続はテストできる）
        'https://httpbin.org/get',
      ];

      const testPromises = testUrls.map((url) =>
        fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000), // 5秒タイムアウト
        }).catch(() => null),
      );

      const results = await Promise.allSettled(testPromises);
      const hasConnection = results.some((result) => result.status === 'fulfilled');

      networkStatus.isOnline = hasConnection;
      networkStatus.lastChecked = Date.now();

      updateNetworkStatus(hasConnection, false);

      if (!hasConnection && !elements.offlineNotice.style.display.includes('block')) {
        showOfflineNotice();
      } else if (hasConnection && elements.offlineNotice.style.display.includes('block')) {
        hideOfflineNotice();
      }

      console.log(`Network connection check: ${hasConnection ? 'online' : 'offline'}`);
      return hasConnection;
    } catch (error) {
      console.warn('Network check failed:', error);
      networkStatus.isOnline = false;
      updateNetworkStatus(false, false);
      showOfflineNotice();
      return false;
    } finally {
      networkStatus.checkInProgress = false;
    }
  }

  // オフライン通知を表示
  function showOfflineNotice(show = true) {
    if (elements.offlineNotice) {
      elements.offlineNotice.style.display = show ? 'flex' : 'none';
    }

    // ネットワークインジケーターを更新
    updateNetworkIndicator(!show);

    if (show) {
      errorRecoveryState.errorType = 'network';
      errorRecoveryState.canRetry = true;
      updateRetryButtonState();
      updateStatus('Offline - no internet connection', 'error');
    }
  }

  // オフライン通知を非表示
  function hideOfflineNotice() {
    if (elements.offlineNotice) {
      elements.offlineNotice.style.transform = 'translateX(-50%) translateY(-20px)';
      elements.offlineNotice.style.opacity = '0';

      setTimeout(() => {
        if (elements.offlineNotice) {
          elements.offlineNotice.style.display = 'none';
          elements.offlineNotice.style.opacity = '1';
        }
      }, 300);
    }
  }

  // ネットワーク状態を取得
  function getNetworkStatus() {
    return {
      ...networkStatus,
      navigatorOnline: navigator.onLine,
    };
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

  // ===============================================
  // タスク4.4: エラーリカバリ機能の実装
  // ===============================================

  /**
   * エラーリカバリシステムの初期化（タスク4.4）
   */
  function initializeErrorRecovery() {
    // API制限エラー関連のイベントリスナー
    if (elements.usageCheckBtn) {
      elements.usageCheckBtn.addEventListener('click', handleUsageCheck);
    }
    if (elements.apiSettingsBtn) {
      elements.apiSettingsBtn.addEventListener('click', handleOpenSettings);
    }
    if (elements.retryBtn) {
      elements.retryBtn.addEventListener('click', handleRetryAction);
    }
  }

  /**
   * API制限エラー時の代替案表示（タスク4.4.1）
   */
  function showAPILimitError(errorInfo) {
    const { type, userMessage, alternatives } = errorInfo;

    // API制限通知を表示
    if (elements.apiLimitNotice) {
      elements.apiLimitNotice.style.display = 'flex';

      // タイトルと種類を更新
      if (elements.limitTitle) {
        const titles = {
          rate_limit: 'API短期制限エラー',
          quota_exceeded: 'API月間制限エラー',
          auth: 'API認証エラー',
        };
        elements.limitTitle.textContent = titles[type] || 'API制限エラー';
      }

      // メッセージを更新
      if (elements.limitMessage) {
        elements.limitMessage.textContent = userMessage;
      }

      // 代替案リストを更新
      if (elements.alternativesList && alternatives && alternatives.length > 0) {
        elements.alternativesList.innerHTML = alternatives.map((alt) => `<li>${alt}</li>`).join('');
      }

      // 重度エラーの場合は再試行ボタンを無効化
      errorRecoveryState.canRetry = type !== 'quota_exceeded';
      updateRetryButtonState();
    }

    // 他のエラー表示を隠す
    hideError();
    hideOCRFallback();

    // エラー情報を記録
    errorRecoveryState.lastError = errorInfo;
    errorRecoveryState.errorType = type;
  }

  /**
   * ネットワーク状態インジケーターの更新（タスク4.4.3）
   */
  function updateNetworkIndicator(isOnline) {
    if (!elements.networkIcon) {return;}

    networkStatus.isOnline = isOnline;

    const indicators = {
      online: { icon: '📶', title: 'オンライン - 接続良好' },
      offline: { icon: '📵', title: 'オフライン - 接続なし' },
      checking: { icon: '🔄', title: '接続確認中...' },
    };

    const status = networkStatus.checkInProgress ? 'checking' : isOnline ? 'online' : 'offline';
    const indicator = indicators[status];

    elements.networkIcon.textContent = indicator.icon;
    if (elements.networkIndicator) {
      elements.networkIndicator.title = indicator.title;
    }
  }

  /**
   * 再試行ボタンの状態更新（タスク4.4.4）
   */
  function updateRetryButtonState() {
    if (!elements.retryBtn) {return;}

    const canRetry =
      errorRecoveryState.canRetry && errorRecoveryState.retryCount < errorRecoveryState.maxRetries;

    elements.retryBtn.style.display = canRetry ? 'flex' : 'none';
    elements.retryBtn.disabled = !canRetry;

    if (canRetry) {
      elements.retryBtn.title = `再試行 (${errorRecoveryState.retryCount}/${errorRecoveryState.maxRetries})`;
    }
  }

  /**
   * 再試行アクションの処理（タスク4.4.4）
   */
  function handleRetryAction() {
    if (
      !errorRecoveryState.canRetry ||
      errorRecoveryState.retryCount >= errorRecoveryState.maxRetries
    ) {
      return;
    }

    errorRecoveryState.retryCount++;
    updateRetryButtonState();

    // エラータイプに応じた再試行処理
    switch (errorRecoveryState.errorType) {
    case 'network':
      performNetworkRetry();
      break;
    case 'rate_limit':
      performTranslationRetry();
      break;
    case 'ocr_failed':
      performOCRRetry();
      break;
    default:
      performGeneralRetry();
      break;
    }
  }

  /**
   * 翻訳再試行（タスク4.4.1）
   */
  function performTranslationRetry() {
    if (!errorRecoveryState.lastTranslationRequest) {
      updateStatus('No previous request to retry', 'warning');
      return;
    }

    updateStatus('Retrying translation...', 'info');
    showLoadingState('翻訳を再試行中...');

    // API制限通知を隠す
    if (elements.apiLimitNotice) {
      elements.apiLimitNotice.style.display = 'none';
    }

    // 元のリクエストを再実行
    const { text, targetLanguage, sourceLanguage } = errorRecoveryState.lastTranslationRequest;

    window.electronAPI
      .translateText({
        text,
        targetLanguage,
        sourceLanguage,
      })
      .then((result) => {
        // 成功時の処理
        showTranslationResult(result);
        resetErrorRecoveryState();
        updateStatus('Translation completed successfully', 'success');
      })
      .catch((error) => {
        // 失敗時の処理
        handleTranslationError(error);
      });
  }

  /**
   * 一般的な再試行処理（タスク4.4.4）
   */
  function performGeneralRetry() {
    updateStatus('Retrying operation...', 'info');

    // 5秒間待機してから状態をリセット
    setTimeout(() => {
      resetErrorRecoveryState();
      hideAllErrorNotices();
      updateStatus('Ready for new translation', 'success');
    }, 5000);
  }

  /**
   * API使用量チェック（タスク4.4.1）
   */
  function handleUsageCheck() {
    updateStatus('Checking API usage...', 'info');

    window.electronAPI
      .getAPIUsage()
      .then((usage) => {
        const { character } = usage;
        const usedPercent = ((character.count / character.limit) * 100).toFixed(1);

        const usageMessage = `使用量: ${character.count.toLocaleString()} / ${character.limit.toLocaleString()} 文字 (${usedPercent}%)`;
        updateStatus(usageMessage, usedPercent > 90 ? 'warning' : 'info');

        // 制限近くの場合は警告表示
        if (usedPercent > 90) {
          showError(`API使用量が制限に近づいています: ${usageMessage}`, 'warning');
        }
      })
      .catch((error) => {
        updateStatus('Usage check failed', 'error');
        console.error('Usage check error:', error);
      });
  }

  /**
   * すべてのエラー通知を隠す
   */
  function hideAllErrorNotices() {
    if (elements.apiLimitNotice) {
      elements.apiLimitNotice.style.display = 'none';
    }
    if (elements.ocrFallbackNotice) {
      elements.ocrFallbackNotice.style.display = 'none';
    }
    if (elements.offlineNotice) {
      elements.offlineNotice.style.display = 'none';
    }
    hideError();
  }

  /**
   * エラーリカバリ状態をリセット
   */
  function resetErrorRecoveryState() {
    errorRecoveryState.lastError = null;
    errorRecoveryState.errorType = null;
    errorRecoveryState.retryCount = 0;
    errorRecoveryState.canRetry = false;
    updateRetryButtonState();
  }

  /**
   * OCRフォールバック表示を隠す
   */
  function hideOCRFallback() {
    if (elements.ocrFallbackNotice) {
      elements.ocrFallbackNotice.style.display = 'none';
    }
  }

  /**
   * 翻訳エラーの処理（エラータイプに応じた表示切り替え）
   */
  function handleTranslationError(error) {
    // リクエスト情報を保存（再試行用）
    errorRecoveryState.lastTranslationRequest = {
      text: elements.manualTextInput?.value || '',
      targetLanguage: elements.targetLanguageSelect?.value || 'ja',
      sourceLanguage: null,
    };

    // エラータイプに応じた処理
    if (error.type === 'rate_limit' || error.type === 'quota_exceeded' || error.type === 'auth') {
      showAPILimitError(error);
    } else if (error.type === 'network') {
      showOfflineNotice(true);
    } else if (error.type === 'ocr_failed') {
      showOCRFallbackMode();
    } else {
      // 一般的なエラー表示
      showError(error.userMessage || error.message, error.severity || 'error');
      errorRecoveryState.lastError = error;
      errorRecoveryState.errorType = error.type;
      errorRecoveryState.canRetry = error.retryable !== false;
      updateRetryButtonState();
    }
  }

  // タスク4.4用のグローバル関数
  window.handleOpenSettings = handleOpenSettings;
  window.handleManualInputFallback = handleManualInputFallback;
  window.showOCRFallbackMode = showOCRFallbackMode;
  window.checkNetworkConnection = checkNetworkConnection;
  window.getNetworkStatus = getNetworkStatus;
  window.getRetryStats = getRetryStats;
  window.performNetworkRetry = performNetworkRetry;
  window.performOCRRetry = performOCRRetry;
  window.performCaptureRetry = performCaptureRetry;
  window.showAPILimitError = showAPILimitError;
  window.showOfflineNotice = showOfflineNotice;
  window.handleTranslationError = handleTranslationError;
  window.updateNetworkIndicator = updateNetworkIndicator;

  // DOMが読み込まれたら初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHUD);
  } else {
    initializeHUD();
  }
})();
