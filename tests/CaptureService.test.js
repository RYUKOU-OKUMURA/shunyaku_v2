/**
 * CaptureService.test.js
 * CaptureServiceのユニットテスト
 */

const fs = require('fs').promises;
const path = require('path');
const CaptureService = require('../src/services/CaptureService');

// Electronのmock
jest.mock('electron', () => ({
  desktopCapturer: {
    getSources: jest.fn(),
  },
}));

describe('CaptureService', () => {
  let captureService;
  let mockDesktopCapturer;
  const mockThumbnail = {
    toPNG: jest.fn(() => Buffer.from('fake-png-data')),
    toDataURL: jest.fn(() => 'data:image/png;base64,fake-data'),
  };

  beforeEach(() => {
    // Electronのmockを取得
    const { desktopCapturer } = require('electron');
    mockDesktopCapturer = desktopCapturer;
    
    captureService = new CaptureService();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    if (captureService) {
      await captureService.shutdown();
    }
  });

  describe('initialization', () => {
    test('should create CaptureService instance', () => {
      expect(captureService).toBeInstanceOf(CaptureService);
      expect(captureService.tempFiles).toBeInstanceOf(Set);
    });

    test('should initialize temp directory', async () => {
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();
      
      await captureService.initializeTempDirectory();
      
      expect(mkdirSpy).toHaveBeenCalledWith(
        expect.stringContaining('Shunyaku'),
        { recursive: true }
      );
      
      mkdirSpy.mockRestore();
    });
  });

  describe('getAvailableSources', () => {
    test('should get available screen sources', async () => {
      const mockSources = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          thumbnail: mockThumbnail,
        },
        {
          id: 'screen:1',
          name: 'Built-in Display',
          thumbnail: mockThumbnail,
        },
      ];

      mockDesktopCapturer.getSources.mockResolvedValue(mockSources);

      const sources = await captureService.getAvailableSources();

      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        id: 'screen:0',
        name: 'Entire Screen',
        thumbnail: 'data:image/png;base64,fake-data',
      });
      expect(mockDesktopCapturer.getSources).toHaveBeenCalledWith({
        types: ['screen'],
        thumbnailSize: { width: 200, height: 150 },
      });
    });

    test('should handle errors when getting sources', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('Access denied'));

      await expect(captureService.getAvailableSources()).rejects.toThrow(
        '画面ソースの取得に失敗しました'
      );
    });
  });

  describe('captureScreen', () => {
    test('should capture screen successfully', async () => {
      const mockSources = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          thumbnail: mockThumbnail,
        },
      ];

      mockDesktopCapturer.getSources.mockResolvedValue(mockSources);
      const writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      const imagePath = await captureService.captureScreen('screen:0');

      expect(imagePath).toMatch(/screenshot_\d+\.png$/);
      expect(writeFileSpy).toHaveBeenCalledWith(
        imagePath,
        Buffer.from('fake-png-data')
      );
      expect(captureService.tempFiles.has(imagePath)).toBe(true);

      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    test('should use first available source when no sourceId specified', async () => {
      const mockSources = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          thumbnail: mockThumbnail,
        },
      ];

      mockDesktopCapturer.getSources.mockResolvedValue(mockSources);
      const writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      const imagePath = await captureService.captureScreen();

      expect(imagePath).toMatch(/screenshot_\d+\.png$/);
      expect(mockDesktopCapturer.getSources).toHaveBeenCalledTimes(2); // 1回目でソース取得、2回目でキャプチャ

      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    test('should handle capture errors', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('No permission'));

      await expect(captureService.captureScreen()).rejects.toThrow(
        'スクリーンショットの取得に失敗しました'
      );
    });

    test('should handle missing source', async () => {
      const mockSources = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          thumbnail: mockThumbnail,
        },
      ];

      mockDesktopCapturer.getSources.mockResolvedValue(mockSources);
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      await expect(captureService.captureScreen('screen:999')).rejects.toThrow(
        'スクリーンショットの取得に失敗しました'
      );

      mkdirSpy.mockRestore();
    });
  });

  describe('captureAllScreens', () => {
    test('should capture all available screens', async () => {
      const mockSources = [
        {
          id: 'screen:0',
          name: 'Entire Screen',
          thumbnail: mockThumbnail,
        },
        {
          id: 'screen:1',
          name: 'Built-in Display',
          thumbnail: mockThumbnail,
        },
      ];

      mockDesktopCapturer.getSources
        .mockResolvedValueOnce(mockSources) // getAvailableSources用
        .mockResolvedValue(mockSources); // captureScreen用

      const writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue();
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      const captures = await captureService.captureAllScreens();

      expect(captures).toHaveLength(2);
      expect(captures[0]).toMatchObject({
        sourceId: 'screen:0',
        sourceName: 'Entire Screen',
        filePath: expect.stringMatching(/screenshot_\d+\.png$/),
      });

      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });
  });

  describe('file management', () => {
    test('should delete temp file', async () => {
      const mockFilePath = '/path/to/test.png';
      captureService.tempFiles.add(mockFilePath);
      
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue();

      await captureService.deleteTempFile(mockFilePath);

      expect(unlinkSpy).toHaveBeenCalledWith(mockFilePath);
      expect(captureService.tempFiles.has(mockFilePath)).toBe(false);

      unlinkSpy.mockRestore();
    });

    test('should cleanup all temp files', async () => {
      const mockFiles = ['/path/to/test1.png', '/path/to/test2.png'];
      mockFiles.forEach(file => captureService.tempFiles.add(file));
      
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue();

      await captureService.cleanupTempFiles();

      expect(unlinkSpy).toHaveBeenCalledTimes(2);
      expect(captureService.tempFiles.size).toBe(0);

      unlinkSpy.mockRestore();
    });

    test('should handle file deletion errors gracefully', async () => {
      const mockFilePath = '/path/to/test.png';
      captureService.tempFiles.add(mockFilePath);
      
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockRejectedValue(new Error('File not found'));

      // エラーが発生してもPromiseはrejectされない
      await expect(captureService.deleteTempFile(mockFilePath)).resolves.not.toThrow();

      unlinkSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    test('should cleanup all files on shutdown', async () => {
      const mockFiles = ['/path/to/test1.png', '/path/to/test2.png'];
      mockFiles.forEach(file => captureService.tempFiles.add(file));
      
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue();

      await captureService.shutdown();

      expect(unlinkSpy).toHaveBeenCalledTimes(2);
      expect(captureService.tempFiles.size).toBe(0);

      unlinkSpy.mockRestore();
    });
  });

  describe('captureRegion', () => {
    test('should throw error for unimplemented region capture', async () => {
      const bounds = { x: 0, y: 0, width: 100, height: 100 };

      await expect(captureService.captureRegion(bounds)).rejects.toThrow(
        '範囲選択キャプチャは未実装です'
      );
    });
  });
});