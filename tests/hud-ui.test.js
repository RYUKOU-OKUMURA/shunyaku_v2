/**
 * HUD UI改善のテスト（タスク3.5）
 * Shunyaku v2 - HUD UIコンポーネントのテスト
 */

/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// HTMLファイルを読み込み
const htmlPath = path.join(__dirname, '../src/renderer/hud.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// CSSファイルを読み込み（テスト用に簡単にロード）
const cssPath = path.join(__dirname, '../src/renderer/hud.css');
const css = fs.readFileSync(cssPath, 'utf8');

describe('HUD UI改善テスト (Task 3.5)', () => {
  let mockElectronAPI;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = html;
    
    // CSS を適用
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // ElectronAPIのモック
    mockElectronAPI = {
      closeHUD: jest.fn().mockResolvedValue(true),
      hideHUD: jest.fn().mockResolvedValue(true),
      translateText: jest.fn().mockResolvedValue({
        success: true,
        result: {
          originalText: 'Hello World',
          translatedText: 'こんにちは世界',
          sourceLanguage: 'en',
          targetLanguage: 'ja'
        }
      }),
      executeFullWorkflow: jest.fn().mockResolvedValue({
        success: true,
        result: {
          original: 'Test text',
          translated: 'テストテキスト',
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          confidence: 95
        }
      }),
      openSettings: jest.fn().mockResolvedValue(true)
    };

    global.window.electronAPI = mockElectronAPI;
    global.navigator.clipboard = {
      writeText: jest.fn().mockResolvedValue()
    };

    // HUD.jsを読み込み
    const jsPath = path.join(__dirname, '../src/renderer/hud.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    eval(jsContent);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('3.5.1 原文・訳文の見やすい表示レイアウト', () => {
    test('テキスト表示エリアが適切にスタイリングされている', () => {
      const textDisplayArea = document.getElementById('textDisplayArea');
      expect(textDisplayArea).toBeTruthy();

      const originalTextSection = document.querySelector('.original-text-section');
      const translationTextSection = document.querySelector('.translation-text-section');

      expect(originalTextSection).toBeTruthy();
      expect(translationTextSection).toBeTruthy();
    });

    test('テキストの長さに応じてスタイリングが適用される', () => {
      const translatedText = document.getElementById('translatedText');
      
      // 短いテキストのテスト
      window.updateTextStyling(translatedText, 'Short text');
      expect(translatedText.classList.contains('short-text')).toBe(true);
      expect(translatedText.classList.contains('long-text')).toBe(false);

      // 長いテキストのテスト  
      const longText = 'A'.repeat(250);
      window.updateTextStyling(translatedText, longText);
      expect(translatedText.classList.contains('long-text')).toBe(true);
      expect(translatedText.classList.contains('short-text')).toBe(false);
    });

    test('言語インジケーターが正しく表示される', () => {
      const parentElement = document.querySelector('.translation-text-section');
      window.addLanguageIndicator(parentElement, 'ja');
      
      const indicator = parentElement.querySelector('.language-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.textContent).toBe('JA');
    });
  });

  describe('3.5.2 コピーボタン実装（clipboard API）', () => {
    test('基本的なコピー機能が動作する', async () => {
      const translatedText = document.getElementById('translatedText');
      translatedText.textContent = 'テストテキスト';

      await window.copyTranslation('translated');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('テストテキスト');
    });

    test('原文のみコピーが動作する', async () => {
      const originalText = document.getElementById('originalText');
      originalText.textContent = 'Original text';

      await window.copyTranslation('original');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Original text');
    });

    test('原文と翻訳の両方コピーが動作する', async () => {
      const originalText = document.getElementById('originalText');
      const translatedText = document.getElementById('translatedText');
      originalText.textContent = 'Original text';
      translatedText.textContent = 'テストテキスト';

      await window.copyTranslation('both');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '原文: Original text\n\n翻訳: テストテキスト'
      );
    });

    test('コピー成功時の視覚フィードバックが動作する', async () => {
      const copyBtn = document.getElementById('copyBtn');
      const translatedText = document.getElementById('translatedText');
      translatedText.textContent = 'テストテキスト';

      await window.copyTranslation('translated');

      // 成功クラスが一時的に追加される
      expect(copyBtn.classList.contains('success')).toBe(true);
    });
  });

  describe('3.5.3 再翻訳ボタン実装', () => {
    test('再翻訳ボタンが正しく動作する', async () => {
      const originalText = document.getElementById('originalText');
      originalText.textContent = 'Hello World';

      await window.refreshTranslation();

      expect(mockElectronAPI.translateText).toHaveBeenCalledWith('Hello World', 'ja');
    });

    test('原文がない場合の適切なエラーハンドリング', async () => {
      const originalText = document.getElementById('originalText');
      originalText.textContent = '';

      await window.refreshTranslation();

      expect(mockElectronAPI.translateText).not.toHaveBeenCalled();
    });

    test('再翻訳中の視覚フィードバックが動作する', async () => {
      const refreshBtn = document.getElementById('refreshBtn');
      const originalText = document.getElementById('originalText');
      originalText.textContent = 'Hello World';

      // 非同期処理をテストするため、Promise を作成
      const translatePromise = window.refreshTranslation();
      
      // 処理中はrefreshingクラスが追加される
      expect(refreshBtn.classList.contains('refreshing')).toBe(true);

      await translatePromise;
    });
  });

  describe('3.5.4 エラーメッセージ表示エリア', () => {
    test('基本的なエラー表示が動作する', () => {
      window.showError('テストエラー', 'network');

      const errorDisplay = document.getElementById('errorDisplay');
      const errorMessage = errorDisplay.querySelector('.error-message');

      expect(errorDisplay.style.display).toBe('flex');
      expect(errorMessage.textContent).toContain('ネットワークエラー');
    });

    test('エラータイプ別のスタイリングが適用される', () => {
      window.showError('警告メッセージ', 'api_key');

      const errorDisplay = document.getElementById('errorDisplay');
      expect(errorDisplay.classList.contains('error-warning')).toBe(true);
    });

    test('エラーアクションボタンが正しく表示される', () => {
      window.showError('エラーメッセージ', 'network');

      const retryBtn = document.querySelector('.retry-btn');
      const dismissBtn = document.querySelector('.dismiss-error-btn');

      expect(retryBtn).toBeTruthy();
      expect(dismissBtn).toBeTruthy();
    });

    test('エラーが非表示になる', () => {
      // まずエラーを表示
      window.showError('テストエラー');
      
      const errorDisplay = document.getElementById('errorDisplay');
      expect(errorDisplay.style.display).toBe('flex');

      // エラーを非表示
      window.hideError();
      expect(errorDisplay.style.display).toBe('none');
    });
  });

  describe('3.5.5 ローディングアニメーション改善', () => {
    test('基本的なローディング表示が動作する', () => {
      window.showLoadingState('translating');

      const loadingIndicator = document.getElementById('loadingIndicator');
      const loadingText = loadingIndicator.querySelector('.loading-text');

      expect(loadingIndicator.style.display).toBe('flex');
      expect(loadingText.textContent).toBe('翻訳中...');
    });

    test('ステージ別のローディングメッセージが表示される', () => {
      window.showLoadingState('ocr');

      const loadingText = document.querySelector('.loading-text');
      expect(loadingText.textContent).toBe('テキスト認識中...');
    });

    test('プログレスバーが追加される', () => {
      window.showLoadingState('capturing');

      const loadingProgress = document.querySelector('.loading-progress');
      expect(loadingProgress).toBeTruthy();

      const loadingBar = document.querySelector('.loading-bar');
      expect(loadingBar).toBeTruthy();
    });

    test('ローディングが非表示になる', () => {
      window.showLoadingState('translating');
      
      const loadingIndicator = document.getElementById('loadingIndicator');
      expect(loadingIndicator.style.display).toBe('flex');

      window.hideLoading();
      expect(loadingIndicator.style.display).toBe('none');
    });
  });

  describe('3.5.6 コンポーネント化', () => {
    test('コピーオプションメニューが作成される', () => {
      const copyOptionsMenu = window.createCopyOptionsMenu();

      expect(copyOptionsMenu.classList.contains('copy-options')).toBe(true);

      const copyOptions = copyOptionsMenu.querySelectorAll('.copy-option');
      expect(copyOptions.length).toBe(3); // 翻訳のみ、原文のみ、両方
    });

    test('言語コードの表示用フォーマットが正しい', () => {
      expect(window.formatLanguageCode('ja')).toBe('JA');
      expect(window.formatLanguageCode('en')).toBe('EN');
      expect(window.formatLanguageCode('unknown')).toBe('UNKNOWN');
    });

    test('エラーリトライ処理が適切にルーティングされる', () => {
      // APIキーエラーの場合
      window.handleErrorRetry('api_key');
      expect(mockElectronAPI.openSettings).toHaveBeenCalled();

      // ネットワークエラーの場合
      const originalText = document.getElementById('originalText');
      originalText.textContent = 'Test';
      window.handleErrorRetry('network');
      expect(mockElectronAPI.translateText).toHaveBeenCalled();
    });
  });

  describe('統合テスト', () => {
    test('完全な翻訳フローの表示更新', () => {
      const testData = {
        originalText: 'Hello World',
        translatedText: 'こんにちは世界',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        confidence: 95
      };

      window.showTranslationResult(testData);

      const originalText = document.getElementById('originalText');
      const translatedText = document.getElementById('translatedText');
      const textDisplayArea = document.getElementById('textDisplayArea');
      const actionButtons = document.getElementById('actionButtons');

      expect(originalText.textContent).toBe('Hello World');
      expect(translatedText.textContent).toBe('こんにちは世界');
      expect(textDisplayArea.style.display).toBe('flex');
      expect(actionButtons.style.display).toBe('flex');

      // 言語インジケーターが追加されているか確認
      const originalIndicator = document.querySelector('.original-text-section .language-indicator');
      const translatedIndicator = document.querySelector('.translation-text-section .language-indicator');
      
      expect(originalIndicator?.textContent).toBe('EN');
      expect(translatedIndicator?.textContent).toBe('JA');
    });

    test('エラーハンドリングとリカバリフロー', async () => {
      // エラーを表示
      window.showError('翻訳エラー', 'network', 'Connection timeout');

      const errorDisplay = document.getElementById('errorDisplay');
      expect(errorDisplay.style.display).toBe('flex');

      // 詳細が表示されているか確認
      const errorDetails = document.querySelector('.error-details');
      expect(errorDetails?.textContent).toBe('Connection timeout');

      // リトライボタンがクリックされた時の動作
      const retryBtn = document.querySelector('.retry-btn');
      expect(retryBtn).toBeTruthy();
    });
  });
});