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
  };

  // HUDの初期化
  function initializeHUD() {
    setupEventListeners();
    updateStatus('ready', '準備完了');
    // eslint-disable-next-line no-console
    console.log('HUD initialized successfully');
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

    // Escキーで閉じる
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeHUD();
      }
    });

    // ドラッグ可能エリアの設定（既にCSSで設定済みだが、追加の制御）
    setupDragBehavior();
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

  // HUDを閉じる
  function closeHUD() {
    updateStatus('closing', '終了中...');

    // Electronメインプロセスに閉じる要求を送信
    if (window.electronAPI && window.electronAPI.closeHUD) {
      window.electronAPI.closeHUD();
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

  // 再翻訳を実行
  function refreshTranslation() {
    updateStatus('processing', '再翻訳中...');

    // 現在はダミーデータで動作確認
    // 実際の翻訳機能は後のフェーズで実装
    setTimeout(() => {
      const originalText = elements.originalText?.textContent || '';
      if (originalText.trim()) {
        // ダミー翻訳（実装確認用）
        const dummyTranslation = `[再翻訳] ${originalText}の翻訳結果`;
        if (elements.translatedText) {
          elements.translatedText.textContent = dummyTranslation;
        }
        updateStatus('ready', '再翻訳完了');
      } else {
        updateStatus('error', '翻訳する原文がありません');
      }

      setTimeout(() => updateStatus('ready', '準備完了'), 2000);
    }, 1000);
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

  // 外部から呼び出し可能な関数をグローバルに公開
  window.HUD = {
    updateTextContent,
    updateStatus,
    copyTranslation,
    refreshTranslation,
    close: closeHUD,
    minimize: minimizeHUD,
  };

  // DOMが読み込まれたら初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHUD);
  } else {
    initializeHUD();
  }
})();
