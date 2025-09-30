const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * HUDWindowManager - HUDウィンドウの管理クラス
 *
 * フレームレス、透過、最前面表示のHUDウィンドウを管理します。
 * タスク1.2: HUDウィンドウの基本実装の一部として作成されました。
 */
class HUDWindowManager {
  constructor() {
    this.hudWindow = null;
    this.isVisible = false;
  }

  /**
   * HUDウィンドウを作成
   * フレームレス、透過、最前面表示で設定
   *
   * @returns {Promise<void>}
   */
  async createHUDWindow() {
    if (this.hudWindow && !this.hudWindow.isDestroyed()) {
      // 既存のウィンドウがある場合は一旦閉じる
      this.hudWindow.close();
    }

    // HUDウィンドウの設定
    const windowOptions = {
      width: 400,
      height: 200,
      show: false, // 初期状態では非表示
      frame: false, // フレームレス
      transparent: true, // 透過設定
      alwaysOnTop: true, // 常時最前面
      skipTaskbar: true, // タスクバーに表示しない
      resizable: false, // リサイズ無効
      maximizable: false, // 最大化無効
      minimizable: false, // 最小化無効
      closable: true, // 閉じるボタン（カスタムUI）
      focusable: true, // フォーカス可能
      hasShadow: false, // ドロップシャドウ無効
      movable: true, // ドラッグ移動を有効化（タスク1.3.1）
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../renderer/preload.js'),
      },
    };

    // macOS専用設定
    if (process.platform === 'darwin') {
      windowOptions.vibrancy = 'hud'; // macOS HUD風の効果
      windowOptions.titleBarStyle = 'hiddenInset'; // タイトルバーを隠す
      windowOptions.type = 'panel'; // パネルタイプ
      windowOptions.level = 'floating'; // floating level（常時最前面より上）
    }

    // HUDウィンドウを作成
    this.hudWindow = new BrowserWindow(windowOptions);

    // HUDのHTMLファイルをロード
    await this.hudWindow.loadFile(path.join(__dirname, '../renderer/hud.html'));

    // ウィンドウイベントハンドラーの設定
    this.setupWindowEventHandlers();

    // ドラッグ動作の最適化（タスク1.3.1）
    this.setupDragBehavior();

    return this.hudWindow;
  }

  /**
   * ウィンドウイベントハンドラーを設定
   *
   * @private
   */
  setupWindowEventHandlers() {
    if (!this.hudWindow) {
      return;
    }

    // ウィンドウが閉じられた時
    this.hudWindow.on('closed', () => {
      this.hudWindow = null;
      this.isVisible = false;
    });

    // ウィンドウが隠された時
    this.hudWindow.on('hide', () => {
      this.isVisible = false;
    });

    // ウィンドウが表示された時
    this.hudWindow.on('show', () => {
      this.isVisible = true;
    });

    // フォーカスが外れた時（オプション：自動で閉じる場合）
    this.hudWindow.on('blur', () => {
      // 現在は何もしない（後のフェーズで自動非表示機能を実装予定）
    });

    // 開発時はDevToolsを開く
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.hudWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }

  /**
   * HUDウィンドウを表示
   *
   * @param {Object} options - 表示オプション
   * @param {number} options.x - X座標（省略時は中央）
   * @param {number} options.y - Y座標（省略時は中央）
   * @returns {Promise<void>}
   */
  async showHUD(options = {}) {
    if (!this.hudWindow || this.hudWindow.isDestroyed()) {
      await this.createHUDWindow();
    }

    // 位置を設定
    if (options.x !== undefined && options.y !== undefined) {
      this.hudWindow.setPosition(Math.floor(options.x), Math.floor(options.y));
    } else {
      // デフォルトは画面中央
      this.centerWindow();
    }

    // ウィンドウを表示
    this.hudWindow.show();
    this.hudWindow.focus();
    this.isVisible = true;
  }

  /**
   * HUDウィンドウを非表示
   */
  hideHUD() {
    if (this.hudWindow && !this.hudWindow.isDestroyed()) {
      this.hudWindow.hide();
      this.isVisible = false;
    }
  }

  /**
   * HUDウィンドウを閉じる
   */
  closeHUD() {
    if (this.hudWindow && !this.hudWindow.isDestroyed()) {
      this.hudWindow.close();
      this.hudWindow = null;
      this.isVisible = false;
    }
  }

  /**
   * ウィンドウを画面中央に配置
   *
   * @private
   */
  centerWindow() {
    if (!this.hudWindow || this.hudWindow.isDestroyed()) {
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const [windowWidth, windowHeight] = this.hudWindow.getSize();

    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = Math.floor((screenHeight - windowHeight) / 2);

    this.hudWindow.setPosition(x, y);
  }

  /**
   * HUDウィンドウの表示状態を取得
   *
   * @returns {boolean} 表示状態
   */
  isHUDVisible() {
    return (
      this.isVisible &&
      this.hudWindow &&
      !this.hudWindow.isDestroyed() &&
      this.hudWindow.isVisible()
    );
  }

  /**
   * HUDウィンドウのインスタンスを取得
   *
   * @returns {BrowserWindow|null} HUDウィンドウインスタンス
   */
  getHUDWindow() {
    return this.hudWindow;
  }

  /**
   * ドラッグ動作の最適化設定（タスク1.3.1）
   * macOS特有のドラッグ体験を向上させる
   *
   * @private
   */
  setupDragBehavior() {
    if (!this.hudWindow || process.platform !== 'darwin') {
      return;
    }

    // ドラッグ開始時の処理
    this.hudWindow.on('move', () => {
      // ウィンドウ移動中の処理（必要に応じて）
      // 画面外への移動制限などを後で実装予定
    });

    // ドラッグ終了時の処理
    this.hudWindow.on('moved', () => {
      // 画面境界のスナップ機能を後で実装予定
      this.validateWindowPosition();
    });
  }

  /**
   * ウィンドウ位置の妥当性チェック（タスク1.3.1補助機能）
   * 画面外に移動しすぎた場合の調整
   *
   * @private
   */
  validateWindowPosition() {
    if (!this.hudWindow || this.hudWindow.isDestroyed()) {
      return;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const [x, y] = this.hudWindow.getPosition();
    const [windowWidth, windowHeight] = this.hudWindow.getSize();

    let newX = x;
    let newY = y;

    // 画面左端からはみ出した場合
    if (x < -windowWidth + 50) {
      newX = -windowWidth + 50;
    }

    // 画面右端からはみ出した場合
    if (x > screenWidth - 50) {
      newX = screenWidth - 50;
    }

    // 画面上端からはみ出した場合
    if (y < 0) {
      newY = 0;
    }

    // 画面下端からはみ出した場合（windowHeightを使用）
    if (y > screenHeight - windowHeight) {
      newY = screenHeight - windowHeight;
    }

    // 位置を修正する必要がある場合のみ移動
    if (newX !== x || newY !== y) {
      this.hudWindow.setPosition(newX, newY);
    }
  }

  /**
   * マウス位置近傍にHUDウィンドウを表示（タスク1.3.4）
   *
   * @param {Object} mousePosition - マウス座標
   * @param {number} mousePosition.x - マウスX座標
   * @param {number} mousePosition.y - マウスY座標
   * @returns {Promise<void>}
   */
  async showHUDNearMouse(mousePosition) {
    if (!this.hudWindow || this.hudWindow.isDestroyed()) {
      await this.createHUDWindow();
    }

    const [windowWidth, windowHeight] = this.hudWindow.getSize();
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // マウス位置からのオフセット（右下に少し離して表示）
    const offsetX = 20;
    const offsetY = 20;

    let x = mousePosition.x + offsetX;
    let y = mousePosition.y + offsetY;

    // 画面境界チェックと調整
    if (x + windowWidth > screenWidth) {
      x = mousePosition.x - windowWidth - offsetX; // 左側に表示
    }

    if (y + windowHeight > screenHeight) {
      y = mousePosition.y - windowHeight - offsetY; // 上側に表示
    }

    // 最小境界チェック
    x = Math.max(0, x);
    y = Math.max(0, y);

    // ウィンドウ位置を設定して表示
    this.hudWindow.setPosition(Math.floor(x), Math.floor(y));
    this.hudWindow.show();
    this.hudWindow.focus();
    this.isVisible = true;
  }

  /**
   * ウィンドウリソースのクリーンアップ
   */
  destroy() {
    this.closeHUD();
  }
}

module.exports = HUDWindowManager;
