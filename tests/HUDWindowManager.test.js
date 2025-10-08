/**
 * HUDWindowManager Unit Tests
 * 
 * Tests for HUD window creation, management, and interaction
 */

const { BrowserWindow } = require('electron');
const path = require('path');

// Mock electron modules
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  screen: {
    getCursorScreenPoint: jest.fn(() => ({ x: 100, y: 100 })),
    getDisplayNearestPoint: jest.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }))
  },
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn()
  }
}));

const HUDWindowManager = require('../src/main/HUDWindowManager');

describe('HUDWindowManager', () => {
  let hudManager;
  let mockWindow;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock window
    mockWindow = {
      loadFile: jest.fn().mockResolvedValue(undefined),
      webContents: {
        send: jest.fn(),
        openDevTools: jest.fn()
      },
      setAlwaysOnTop: jest.fn(),
      setVisibleOnAllWorkspaces: jest.fn(),
      setFullScreenable: jest.fn(),
      setPosition: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      close: jest.fn(),
      destroy: jest.fn(),
      isDestroyed: jest.fn(() => false),
      on: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
      getBounds: jest.fn(() => ({ x: 100, y: 100, width: 400, height: 300 })),
      setBounds: jest.fn()
    };

    BrowserWindow.mockImplementation(() => mockWindow);

    hudManager = new HUDWindowManager();
  });

  afterEach(() => {
    if (hudManager) {
      hudManager.cleanup();
    }
  });

  describe('constructor', () => {
    test('should initialize with default settings', () => {
      expect(hudManager).toBeInstanceOf(HUDWindowManager);
      expect(hudManager.currentWindow).toBeNull();
    });
  });

  describe('showHUD', () => {
    test('should create and show HUD window with text', async () => {
      const originalText = 'Hello World';
      const translatedText = 'こんにちは世界';

      await hudManager.showHUD(originalText, translatedText);

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: expect.any(Number),
        height: expect.any(Number),
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        transparent: true,
        resizable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: expect.stringContaining('preload.js')
        }
      });

      expect(mockWindow.loadFile).toHaveBeenCalledWith(
        expect.stringContaining('hud.html')
      );
      expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
      expect(mockWindow.show).toHaveBeenCalled();
    });

    test('should send text data to renderer after window loads', async () => {
      const originalText = 'Test text';
      const translatedText = 'テストテキスト';

      // Mock window load completion
      mockWindow.loadFile.mockImplementation(async () => {
        // Simulate window ready event
        const onCall = mockWindow.on.mock.calls.find(call => call[0] === 'ready-to-show');
        if (onCall) {
          onCall[1](); // Call the ready-to-show handler
        }
      });

      await hudManager.showHUD(originalText, translatedText);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-update', {
        originalText,
        translatedText,
        timestamp: expect.any(Number)
      });
    });

    test('should position window near cursor', async () => {
      await hudManager.showHUD('Test', 'テスト');

      expect(mockWindow.setPosition).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number)
      );
    });

    test('should reuse existing window if available', async () => {
      // First call
      await hudManager.showHUD('First', '最初');
      expect(BrowserWindow).toHaveBeenCalledTimes(1);

      // Second call should reuse window
      await hudManager.showHUD('Second', '2番目');
      expect(BrowserWindow).toHaveBeenCalledTimes(1);
      expect(mockWindow.show).toHaveBeenCalledTimes(2);
    });

    test('should handle window creation failure gracefully', async () => {
      BrowserWindow.mockImplementation(() => {
        throw new Error('Window creation failed');
      });

      await expect(hudManager.showHUD('Test', 'テスト')).rejects.toThrow('Window creation failed');
    });
  });

  describe('hideHUD', () => {
    test('should hide existing HUD window', async () => {
      await hudManager.showHUD('Test', 'テスト');
      hudManager.hideHUD();

      expect(mockWindow.hide).toHaveBeenCalled();
    });

    test('should handle hiding when no window exists', () => {
      expect(() => hudManager.hideHUD()).not.toThrow();
    });
  });

  describe('closeHUD', () => {
    test('should close and clean up HUD window', async () => {
      await hudManager.showHUD('Test', 'テスト');
      hudManager.closeHUD();

      expect(mockWindow.close).toHaveBeenCalled();
      expect(hudManager.currentWindow).toBeNull();
    });

    test('should handle closing when no window exists', () => {
      expect(() => hudManager.closeHUD()).not.toThrow();
    });
  });

  describe('isHUDVisible', () => {
    test('should return true when HUD is visible', async () => {
      mockWindow.isVisible = jest.fn(() => true);
      await hudManager.showHUD('Test', 'テスト');

      expect(hudManager.isHUDVisible()).toBe(true);
    });

    test('should return false when no HUD exists', () => {
      expect(hudManager.isHUDVisible()).toBe(false);
    });

    test('should return false when HUD is hidden', async () => {
      mockWindow.isVisible = jest.fn(() => false);
      await hudManager.showHUD('Test', 'テスト');
      hudManager.hideHUD();

      expect(hudManager.isHUDVisible()).toBe(false);
    });
  });

  describe('updateHUDContent', () => {
    test('should update content of existing HUD', async () => {
      await hudManager.showHUD('Old', '古い');
      
      hudManager.updateHUDContent('New', '新しい');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('hud-update', {
        originalText: 'New',
        translatedText: '新しい',
        timestamp: expect.any(Number)
      });
    });

    test('should handle update when no window exists', () => {
      expect(() => hudManager.updateHUDContent('Test', 'テスト')).not.toThrow();
    });
  });

  describe('_calculatePosition', () => {
    test('should calculate position near cursor within screen bounds', () => {
      const position = hudManager._calculatePosition({ width: 400, height: 300 });

      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.x + 400).toBeLessThanOrEqual(1920);
      expect(position.y + 300).toBeLessThanOrEqual(1080);
    });

    test('should adjust position to stay within screen bounds', () => {
      // Mock cursor near screen edge
      const { screen } = require('electron');
      screen.getCursorScreenPoint.mockReturnValue({ x: 1800, y: 1000 });

      const position = hudManager._calculatePosition({ width: 400, height: 300 });

      expect(position.x + 400).toBeLessThanOrEqual(1920);
      expect(position.y + 300).toBeLessThanOrEqual(1080);
    });
  });

  describe('_setupWindowEventHandlers', () => {
    test('should register window event handlers', async () => {
      await hudManager.showHUD('Test', 'テスト');

      expect(mockWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
      expect(mockWindow.on).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
    });

    test('should handle window closed event', async () => {
      await hudManager.showHUD('Test', 'テスト');

      // Find and call the closed event handler
      const closedHandler = mockWindow.on.mock.calls.find(call => call[0] === 'closed')[1];
      closedHandler();

      expect(hudManager.currentWindow).toBeNull();
    });
  });

  describe('cleanup', () => {
    test('should clean up resources', async () => {
      await hudManager.showHUD('Test', 'テスト');
      hudManager.cleanup();

      expect(mockWindow.removeAllListeners).toHaveBeenCalled();
      expect(mockWindow.close).toHaveBeenCalled();
      expect(hudManager.currentWindow).toBeNull();
    });

    test('should handle cleanup when no window exists', () => {
      expect(() => hudManager.cleanup()).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle renderer process crash', async () => {
      await hudManager.showHUD('Test', 'テスト');

      // Simulate renderer crash
      mockWindow.webContents.send.mockImplementation(() => {
        throw new Error('Renderer process crashed');
      });

      expect(() => hudManager.updateHUDContent('New', '新しい')).not.toThrow();
    });

    test('should handle window destruction', async () => {
      await hudManager.showHUD('Test', 'テスト');
      mockWindow.isDestroyed.mockReturnValue(true);

      expect(() => hudManager.hideHUD()).not.toThrow();
    });
  });

  describe('window properties', () => {
    test('should create window with correct properties', async () => {
      await hudManager.showHUD('Test', 'テスト');

      const browserWindowCall = BrowserWindow.mock.calls[0][0];
      expect(browserWindowCall.frame).toBe(false);
      expect(browserWindowCall.alwaysOnTop).toBe(true);
      expect(browserWindowCall.skipTaskbar).toBe(true);
      expect(browserWindowCall.transparent).toBe(true);
      expect(browserWindowCall.webPreferences.nodeIntegration).toBe(false);
      expect(browserWindowCall.webPreferences.contextIsolation).toBe(true);
    });

    test('should set window as floating level', async () => {
      await hudManager.showHUD('Test', 'テスト');

      expect(mockWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
      expect(mockWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true);
      expect(mockWindow.setFullScreenable).toHaveBeenCalledWith(false);
    });
  });
});