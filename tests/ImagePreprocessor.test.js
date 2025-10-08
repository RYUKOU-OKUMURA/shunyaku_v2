/**
 * ImagePreprocessor Unit Tests
 * 
 * Tests for image preprocessing functionality used by OCR
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// Mock sharp
jest.mock('sharp');

const ImagePreprocessor = require('../src/services/ImagePreprocessor');

describe('ImagePreprocessor', () => {
  let preprocessor;
  let mockSharp;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock sharp instance
    mockSharp = {
      resize: jest.fn().mockReturnThis(),
      greyscale: jest.fn().mockReturnThis(),
      normalize: jest.fn().mockReturnThis(),
      sharpen: jest.fn().mockReturnThis(),
      threshold: jest.fn().mockReturnThis(),
      median: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed-image-data')),
      metadata: jest.fn().mockResolvedValue({
        width: 400,
        height: 300,
        channels: 3,
        format: 'png'
      })
    };

    sharp.mockReturnValue(mockSharp);
    
    preprocessor = new ImagePreprocessor();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      expect(preprocessor).toBeInstanceOf(ImagePreprocessor);
      expect(preprocessor.options).toBeDefined();
      expect(preprocessor.options.scaleFactor).toBe(2);
    });

    test('should accept custom options', () => {
      const customOptions = {
        scaleFactor: 3,
        enableDenoising: false,
        sharpening: 2.0
      };

      const customPreprocessor = new ImagePreprocessor(customOptions);
      expect(customPreprocessor.options.scaleFactor).toBe(3);
      expect(customPreprocessor.options.enableDenoising).toBe(false);
      expect(customPreprocessor.options.sharpening).toBe(2.0);
    });
  });

  describe('processForOCR', () => {
    const inputPath = '/fake/input/image.png';
    const outputPath = '/fake/output/processed.png';

    test('should process image with default settings', async () => {
      const result = await preprocessor.processForOCR(inputPath, outputPath);

      expect(sharp).toHaveBeenCalledWith(inputPath);
      expect(mockSharp.resize).toHaveBeenCalledWith({
        width: expect.any(Number),
        height: expect.any(Number),
        kernel: sharp.kernel.lanczos3,
        fit: 'inside',
        withoutEnlargement: false
      });
      expect(mockSharp.greyscale).toHaveBeenCalled();
      expect(mockSharp.normalize).toHaveBeenCalled();
      expect(mockSharp.png).toHaveBeenCalledWith({ quality: 100 });
      expect(mockSharp.toFile).toHaveBeenCalledWith(outputPath);

      expect(result).toEqual({
        inputPath,
        outputPath,
        originalSize: { width: 400, height: 300 },
        processedSize: { width: 800, height: 600 },
        operations: expect.arrayContaining([
          'upscale', 'greyscale', 'normalize'
        ])
      });
    });

    test('should apply sharpening when enabled', async () => {
      preprocessor.options.enableSharpening = true;
      preprocessor.options.sharpening = 1.5;

      await preprocessor.processForOCR(inputPath, outputPath);

      expect(mockSharp.sharpen).toHaveBeenCalledWith(1.5);
    });

    test('should apply denoising when enabled', async () => {
      preprocessor.options.enableDenoising = true;
      preprocessor.options.denoisingRadius = 2;

      await preprocessor.processForOCR(inputPath, outputPath);

      expect(mockSharp.median).toHaveBeenCalledWith(2);
    });

    test('should apply thresholding when enabled', async () => {
      preprocessor.options.enableThresholding = true;
      preprocessor.options.threshold = 128;

      await preprocessor.processForOCR(inputPath, outputPath);

      expect(mockSharp.threshold).toHaveBeenCalledWith(128);
    });

    test('should handle processing errors', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Processing failed'));

      await expect(preprocessor.processForOCR(inputPath, outputPath))
        .rejects.toThrow('Processing failed');
    });

    test('should handle invalid input path', async () => {
      sharp.mockImplementation(() => {
        throw new Error('Input file not found');
      });

      await expect(preprocessor.processForOCR(inputPath, outputPath))
        .rejects.toThrow('Input file not found');
    });
  });

  describe('processToBuffer', () => {
    const inputPath = '/fake/input/image.png';

    test('should process image to buffer', async () => {
      const result = await preprocessor.processToBuffer(inputPath);

      expect(sharp).toHaveBeenCalledWith(inputPath);
      expect(mockSharp.toBuffer).toHaveBeenCalled();
      expect(result).toEqual({
        buffer: Buffer.from('processed-image-data'),
        originalSize: { width: 400, height: 300 },
        processedSize: expect.any(Object),
        operations: expect.any(Array)
      });
    });

    test('should apply all enabled preprocessing operations', async () => {
      preprocessor.options = {
        ...preprocessor.options,
        enableSharpening: true,
        enableDenoising: true,
        enableThresholding: true,
        sharpening: 2.0,
        denoisingRadius: 1,
        threshold: 140
      };

      await preprocessor.processToBuffer(inputPath);

      expect(mockSharp.sharpen).toHaveBeenCalledWith(2.0);
      expect(mockSharp.median).toHaveBeenCalledWith(1);
      expect(mockSharp.threshold).toHaveBeenCalledWith(140);
    });
  });

  describe('analyzeImage', () => {
    const imagePath = '/fake/image.png';

    test('should analyze image metadata', async () => {
      const result = await preprocessor.analyzeImage(imagePath);

      expect(sharp).toHaveBeenCalledWith(imagePath);
      expect(mockSharp.metadata).toHaveBeenCalled();
      expect(result).toEqual({
        width: 400,
        height: 300,
        channels: 3,
        format: 'png',
        aspectRatio: 400 / 300,
        totalPixels: 400 * 300,
        recommendations: expect.any(Array)
      });
    });

    test('should provide optimization recommendations', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 100,
        height: 80,
        channels: 1,
        format: 'jpeg'
      });

      const result = await preprocessor.analyzeImage(imagePath);

      expect(result.recommendations).toContain('Image is quite small, consider using higher scale factor');
      expect(result.recommendations).toContain('Image is already greyscale');
    });

    test('should handle analysis errors', async () => {
      mockSharp.metadata.mockRejectedValue(new Error('Cannot read image metadata'));

      await expect(preprocessor.analyzeImage(imagePath))
        .rejects.toThrow('Cannot read image metadata');
    });
  });

  describe('getOptimalSettings', () => {
    test('should return optimal settings for small images', () => {
      const imageInfo = { width: 150, height: 100, channels: 3 };
      const settings = preprocessor.getOptimalSettings(imageInfo);

      expect(settings.scaleFactor).toBeGreaterThan(2);
      expect(settings.enableSharpening).toBe(true);
      expect(settings.enableDenoising).toBe(true);
    });

    test('should return optimal settings for large images', () => {
      const imageInfo = { width: 2000, height: 1500, channels: 3 };
      const settings = preprocessor.getOptimalSettings(imageInfo);

      expect(settings.scaleFactor).toBeLessThanOrEqual(2);
      expect(settings.enableDenoising).toBe(false);
    });

    test('should return optimal settings for noisy images', () => {
      const imageInfo = { 
        width: 800, 
        height: 600, 
        channels: 3,
        noise: true,
        quality: 'low'
      };
      const settings = preprocessor.getOptimalSettings(imageInfo);

      expect(settings.enableDenoising).toBe(true);
      expect(settings.denoisingRadius).toBeGreaterThanOrEqual(2);
      expect(settings.enableSharpening).toBe(true);
    });
  });

  describe('_calculateTargetSize', () => {
    test('should calculate scaled dimensions correctly', () => {
      const originalSize = { width: 200, height: 150 };
      const scaleFactor = 2;

      const result = preprocessor._calculateTargetSize(originalSize, scaleFactor);

      expect(result).toEqual({
        width: 400,
        height: 300
      });
    });

    test('should respect maximum dimensions', () => {
      const originalSize = { width: 1000, height: 800 };
      const scaleFactor = 5;

      const result = preprocessor._calculateTargetSize(originalSize, scaleFactor);

      // Should be capped at reasonable maximum
      expect(result.width).toBeLessThanOrEqual(4000);
      expect(result.height).toBeLessThanOrEqual(4000);
    });

    test('should maintain aspect ratio', () => {
      const originalSize = { width: 300, height: 200 };
      const scaleFactor = 1.5;

      const result = preprocessor._calculateTargetSize(originalSize, scaleFactor);
      const originalRatio = originalSize.width / originalSize.height;
      const resultRatio = result.width / result.height;

      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.01);
    });
  });

  describe('_applyProcessingChain', () => {
    test('should apply processing operations in correct order', async () => {
      const targetSize = { width: 800, height: 600 };
      const options = {
        scaleFactor: 2,
        enableSharpening: true,
        enableDenoising: true,
        enableThresholding: true,
        sharpening: 1.0,
        denoisingRadius: 1,
        threshold: 128
      };

      const result = await preprocessor._applyProcessingChain(mockSharp, targetSize, options);

      // Check order of operations
      const calls = mockSharp.resize.mock.invocationCallOrder;
      const sharpenCalls = mockSharp.sharpen.mock.invocationCallOrder;
      const denoiseCalls = mockSharp.median.mock.invocationCallOrder;

      expect(sharpenCalls[0]).toBeGreaterThan(calls[0]); // Sharpening after resize
      expect(denoiseCalls[0]).toBeGreaterThan(calls[0]); // Denoising after resize
      
      expect(result).toEqual(['upscale', 'greyscale', 'normalize', 'sharpen', 'denoise', 'threshold']);
    });

    test('should skip disabled operations', async () => {
      const targetSize = { width: 800, height: 600 };
      const options = {
        scaleFactor: 2,
        enableSharpening: false,
        enableDenoising: false,
        enableThresholding: false
      };

      const result = await preprocessor._applyProcessingChain(mockSharp, targetSize, options);

      expect(mockSharp.sharpen).not.toHaveBeenCalled();
      expect(mockSharp.median).not.toHaveBeenCalled();
      expect(mockSharp.threshold).not.toHaveBeenCalled();
      expect(result).toEqual(['upscale', 'greyscale', 'normalize']);
    });
  });

  describe('cleanup', () => {
    test('should clean up temporary resources', () => {
      expect(() => preprocessor.cleanup()).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should provide meaningful error messages', async () => {
      sharp.mockImplementation(() => {
        throw new Error('Unsupported image format');
      });

      try {
        await preprocessor.processForOCR('/fake/path.webp', '/fake/output.png');
      } catch (error) {
        expect(error.message).toContain('Unsupported image format');
      }
    });

    test('should handle out of memory errors', async () => {
      mockSharp.toFile.mockRejectedValue(new Error('Cannot allocate memory'));

      await expect(preprocessor.processForOCR('/fake/large.png', '/fake/output.png'))
        .rejects.toThrow('Cannot allocate memory');
    });
  });

  describe('performance considerations', () => {
    test('should not process extremely large images', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 10000,
        height: 8000,
        channels: 3,
        format: 'png'
      });

      const result = await preprocessor.analyzeImage('/fake/huge.png');
      
      expect(result.recommendations).toContain('Image is very large, consider reducing scale factor');
    });

    test('should handle very small images appropriately', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 50,
        height: 30,
        channels: 3,
        format: 'png'
      });

      const result = await preprocessor.analyzeImage('/fake/tiny.png');
      
      expect(result.recommendations).toContain('Image is quite small, consider using higher scale factor');
    });
  });
});