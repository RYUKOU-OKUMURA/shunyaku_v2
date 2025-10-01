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

  // HUDの初期化
  function initializeHUD() {
    setupEventListeners();
    initializeManualTranslation();
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

    // コピーボタン
    if (elements.copyBtn) {
      elements.copyBtn.addEventListener('click', copyTranslation);
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

  // 翻訳テキストをクリップボードにコピー
  async function copyTranslation() {
    const translatedText = elements.translatedText?.textContent || '';

    if (!translatedText.trim()) {
      updateStatus('error', 'コピーするテキストがありません');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
      return;
    }

    try {
      updateStatus('processing', 'コピー中...');

      // Clipboard APIを使用してコピー
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(translatedText);
      } else {
        // フォールバック: 選択してコピー
        const textArea = document.createElement('textarea');
        textArea.value = translatedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      updateStatus('ready', 'コピー完了');

      // 視覚フィードバック
      elements.copyBtn?.classList.add('success');
      setTimeout(() => {
        elements.copyBtn?.classList.remove('success');
        updateStatus('ready', '準備完了');
      }, 1000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy text:', error);
      updateStatus('error', 'コピーに失敗しました');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
    }
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
    if (!elements.manualTextInput || !elements.characterCount) {return;}

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
    if (!elements.translateBtn || !elements.manualTextInput) {return;}

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
    if (!elements.manualTextInput || !elements.targetLanguageSelect) {return;}

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

  // ローディング状態を表示
  function showLoadingState() {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.style.display = 'flex';
    }
    if (elements.translateBtn) {
      elements.translateBtn.disabled = true;
      elements.translateBtnIcon.textContent = '⟳';
      elements.translateBtnText.textContent = '翻訳中...';
    }
    hideError();
  }

  // 翻訳結果を表示
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
    }
    if (elements.translatedText) {
      elements.translatedText.textContent = result.translatedText;
    }

    hideLoading();
    hideError();
  }

  // エラーを表示
  function showError(message, errorType = null) {
    if (!elements.errorDisplay || !elements.errorMessage) {return;}

    let displayMessage = message;

    // エラー種別に応じてユーザーフレンドリーなメッセージに変換
    if (errorType) {
      switch (errorType) {
      case 'api_key':
        displayMessage = 'APIキーが設定されていないか、無効です。設定画面でAPIキーを確認してください。';
        break;
      case 'quota_exceeded':
        displayMessage = 'API使用量の上限に達しました。しばらく時間をおいてから再試行してください。';
        break;
      case 'network':
        displayMessage = 'ネットワークエラーです。インターネット接続を確認してください。';
        break;
      case 'validation':
        displayMessage = '入力テキストに問題があります。内容を確認してください。';
        break;
      }
    }

    elements.errorMessage.textContent = displayMessage;
    elements.errorDisplay.style.display = 'flex';

    hideLoading();
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

  // 再翻訳を実行（既存の関数を拡張）
  function refreshTranslation() {
    const originalText = elements.originalText?.textContent || '';
    if (!originalText.trim()) {
      updateStatus('error', '再翻訳する原文がありません');
      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
      return;
    }

    // 原文をテキスト入力欄に設定して翻訳実行
    if (elements.manualTextInput) {
      elements.manualTextInput.value = originalText;
      updateCharacterCount();
      updateTranslateButtonState();
      performTranslation();
    }
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
  };

  // DOMが読み込まれたら初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHUD);
  } else {
    initializeHUD();
  }
})();
