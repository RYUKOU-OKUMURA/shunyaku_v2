/**
 * HUD Window Manager Tests
 * Task 1.2: HUDウィンドウの基本実装のテスト
 */

const HUDWindowManager = require('../src/main/HUDWindowManager');

// Electronのモック
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    close: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    getSize: jest.fn().mockReturnValue([400, 200]),
    setPosition: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
    },
  })),
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
    }),
  },
}));

describe('HUDWindowManager', () => {
  let hudWindowManager;

  beforeEach(() => {
    hudWindowManager = new HUDWindowManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (hudWindowManager) {
      hudWindowManager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      expect(hudWindowManager.isHUDVisible()).toBe(false);
      expect(hudWindowManager.getHUDWindow()).toBe(null);
    });
  });

  describe('HUD Window Creation', () => {
    test('should create HUD window with correct configuration', async () => {
      const { BrowserWindow } = require('electron');

      await hudWindowManager.createHUDWindow();

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 400,
          height: 200,
          show: false,
          frame: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
          maximizable: false,
          minimizable: false,
          closable: true,
          focusable: true,
          hasShadow: false,
        }),
      );
    });

    test('should load HUD HTML file', async () => {
      await hudWindowManager.createHUDWindow();

      const hudWindow = hudWindowManager.getHUDWindow();
      expect(hudWindow.loadFile).toHaveBeenCalled();
    });
  });

  describe('HUD Window Display', () => {
    test('should show HUD window', async () => {
      await hudWindowManager.showHUD();

      expect(hudWindowManager.isHUDVisible()).toBe(true);
    });

    test('should hide HUD window', async () => {
      await hudWindowManager.showHUD();
      hudWindowManager.hideHUD();

      expect(hudWindowManager.isVisible).toBe(false);
    });

    test('should close HUD window', async () => {
      await hudWindowManager.showHUD();
      hudWindowManager.closeHUD();

      expect(hudWindowManager.isVisible).toBe(false);
      expect(hudWindowManager.getHUDWindow()).toBe(null);
    });
  });

  describe('Position Management', () => {
    test('should show HUD at specified position', async () => {
      const testPosition = { x: 100, y: 200 };
      await hudWindowManager.showHUD(testPosition);

      const hudWindow = hudWindowManager.getHUDWindow();
      expect(hudWindow.setPosition).toHaveBeenCalledWith(100, 200);
    });

    test('should center window when no position specified', async () => {
      await hudWindowManager.showHUD();

      const hudWindow = hudWindowManager.getHUDWindow();
      // Center calculation: (1920-400)/2 = 760, (1080-200)/2 = 440
      expect(hudWindow.setPosition).toHaveBeenCalledWith(760, 440);
    });
  });

  describe('Cleanup', () => {
    test('should destroy HUD window properly', async () => {
      await hudWindowManager.showHUD();
      hudWindowManager.destroy();

      expect(hudWindowManager.getHUDWindow()).toBe(null);
    });
  });
});