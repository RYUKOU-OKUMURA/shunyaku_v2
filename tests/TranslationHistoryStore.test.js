/**
 * TranslationHistoryStore Unit Tests
 * 
 * Tests for translation history storage and retrieval functionality
 */

const Store = require('electron-store');

// Mock electron-store
jest.mock('electron-store');

const TranslationHistoryStore = require('../src/services/TranslationHistoryStore');

describe('TranslationHistoryStore', () => {
  let historyStore;
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock store
    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      size: 0,
      store: {}
    };

    Store.mockImplementation(() => mockStore);
    
    historyStore = new TranslationHistoryStore();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      expect(historyStore).toBeInstanceOf(TranslationHistoryStore);
      expect(Store).toHaveBeenCalledWith({
        name: 'translation-history',
        defaults: {
          history: [],
          searchIndex: {},
          stats: {
            totalTranslations: 0,
            firstTranslationDate: null,
            lastTranslationDate: null,
            mostUsedLanguagePair: null,
            totalCharactersTranslated: 0
          }
        }
      });
    });

    test('should accept custom options', () => {
      const customOptions = {
        maxHistorySize: 50,
        enableSearch: false
      };

      const customHistoryStore = new TranslationHistoryStore(customOptions);
      expect(customHistoryStore.options.maxHistorySize).toBe(50);
      expect(customHistoryStore.options.enableSearch).toBe(false);
    });
  });

  describe('addTranslation', () => {
    const sampleTranslation = {
      originalText: 'Hello World',
      translatedText: 'こんにちは世界',
      sourceLang: 'en',
      targetLang: 'ja'
    };

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return [];
        if (key === 'searchIndex') return {};
        if (key === 'stats') return {
          totalTranslations: 0,
          firstTranslationDate: null,
          lastTranslationDate: null,
          mostUsedLanguagePair: null,
          totalCharactersTranslated: 0
        };
        return null;
      });
    });

    test('should add translation to history', async () => {
      const result = await historyStore.addTranslation(sampleTranslation);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.originalText).toBe(sampleTranslation.originalText);
      expect(result.translatedText).toBe(sampleTranslation.translatedText);
      expect(result.timestamp).toBeDefined();
      expect(mockStore.set).toHaveBeenCalledWith('history', expect.any(Array));
    });

    test('should generate unique IDs for translations', async () => {
      const translation1 = await historyStore.addTranslation(sampleTranslation);
      const translation2 = await historyStore.addTranslation({
        ...sampleTranslation,
        originalText: 'Different text'
      });

      expect(translation1.id).not.toBe(translation2.id);
    });

    test('should update statistics', async () => {
      await historyStore.addTranslation(sampleTranslation);

      expect(mockStore.set).toHaveBeenCalledWith('stats', expect.objectContaining({
        totalTranslations: 1,
        firstTranslationDate: expect.any(Number),
        lastTranslationDate: expect.any(Number),
        totalCharactersTranslated: sampleTranslation.originalText.length
      }));
    });

    test('should maintain history size limit', async () => {
      // Setup existing history at max size
      const existingHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `id-${i}`,
        originalText: `Text ${i}`,
        translatedText: `翻訳${i}`,
        timestamp: Date.now() - i * 1000
      }));

      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return existingHistory;
        if (key === 'searchIndex') return {};
        if (key === 'stats') return {
          totalTranslations: 100,
          firstTranslationDate: Date.now() - 100000,
          lastTranslationDate: Date.now() - 1000,
          mostUsedLanguagePair: null,
          totalCharactersTranslated: 1000
        };
        return null;
      });

      await historyStore.addTranslation(sampleTranslation);

      // Should remove oldest entry
      const setCall = mockStore.set.mock.calls.find(call => call[0] === 'history');
      const updatedHistory = setCall[1];
      expect(updatedHistory.length).toBe(100);
      expect(updatedHistory[0].originalText).toBe(sampleTranslation.originalText);
    });

    test('should update search index when enabled', async () => {
      historyStore.options.enableSearch = true;

      await historyStore.addTranslation(sampleTranslation);

      expect(mockStore.set).toHaveBeenCalledWith('searchIndex', expect.any(Object));
    });

    test('should handle validation errors', async () => {
      const invalidTranslation = {
        originalText: '', // Empty text
        translatedText: 'Valid translation'
      };

      await expect(historyStore.addTranslation(invalidTranslation))
        .rejects.toThrow('Original text is required');
    });
  });

  describe('getHistory', () => {
    const sampleHistory = [
      {
        id: 'id-1',
        originalText: 'Hello',
        translatedText: 'こんにちは',
        timestamp: Date.now() - 1000,
        sourceLang: 'en',
        targetLang: 'ja'
      },
      {
        id: 'id-2',
        originalText: 'World',
        translatedText: '世界',
        timestamp: Date.now() - 2000,
        sourceLang: 'en',
        targetLang: 'ja'
      }
    ];

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return sampleHistory;
        return null;
      });
    });

    test('should return full history with default options', async () => {
      const result = await historyStore.getHistory();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('id-1');
      expect(result[1].id).toBe('id-2');
    });

    test('should limit results when specified', async () => {
      const result = await historyStore.getHistory({ limit: 1 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-1');
    });

    test('should support pagination with offset', async () => {
      const result = await historyStore.getHistory({ limit: 1, offset: 1 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-2');
    });

    test('should filter by language pair', async () => {
      const mixedHistory = [
        ...sampleHistory,
        {
          id: 'id-3',
          originalText: 'Bonjour',
          translatedText: 'こんにちは',
          sourceLang: 'fr',
          targetLang: 'ja',
          timestamp: Date.now()
        }
      ];

      mockStore.get.mockReturnValue(mixedHistory);

      const result = await historyStore.getHistory({
        sourceLang: 'fr',
        targetLang: 'ja'
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-3');
    });

    test('should filter by date range', async () => {
      const now = Date.now();
      const result = await historyStore.getHistory({
        startDate: now - 1500,
        endDate: now - 500
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-1');
    });
  });

  describe('searchHistory', () => {
    const sampleHistory = [
      {
        id: 'id-1',
        originalText: 'Hello World',
        translatedText: 'こんにちは世界',
        timestamp: Date.now()
      },
      {
        id: 'id-2',
        originalText: 'Good morning',
        translatedText: 'おはよう',
        timestamp: Date.now() - 1000
      }
    ];

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return sampleHistory;
        return null;
      });
    });

    test('should search in original text', async () => {
      const result = await historyStore.searchHistory('Hello');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-1');
    });

    test('should search in translated text', async () => {
      const result = await historyStore.searchHistory('おはよう');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-2');
    });

    test('should perform case-insensitive search', async () => {
      const result = await historyStore.searchHistory('hello');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('id-1');
    });

    test('should return empty array for no matches', async () => {
      const result = await historyStore.searchHistory('nonexistent');

      expect(result).toHaveLength(0);
    });

    test('should handle empty search query', async () => {
      const result = await historyStore.searchHistory('');

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteTranslation', () => {
    const sampleHistory = [
      { id: 'id-1', originalText: 'Hello', translatedText: 'こんにちは' },
      { id: 'id-2', originalText: 'World', translatedText: '世界' }
    ];

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return [...sampleHistory];
        return null;
      });
    });

    test('should delete existing translation', async () => {
      const result = await historyStore.deleteTranslation('id-1');

      expect(result).toBe(true);
      const setCall = mockStore.set.mock.calls.find(call => call[0] === 'history');
      const updatedHistory = setCall[1];
      expect(updatedHistory).toHaveLength(1);
      expect(updatedHistory[0].id).toBe('id-2');
    });

    test('should return false for non-existent ID', async () => {
      const result = await historyStore.deleteTranslation('nonexistent');

      expect(result).toBe(false);
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    test('should handle empty history', async () => {
      mockStore.get.mockReturnValue([]);

      const result = await historyStore.deleteTranslation('id-1');

      expect(result).toBe(false);
    });
  });

  describe('clearHistory', () => {
    test('should clear all history data', async () => {
      await historyStore.clearHistory();

      expect(mockStore.set).toHaveBeenCalledWith('history', []);
      expect(mockStore.set).toHaveBeenCalledWith('searchIndex', {});
      expect(mockStore.set).toHaveBeenCalledWith('stats', {
        totalTranslations: 0,
        firstTranslationDate: null,
        lastTranslationDate: null,
        mostUsedLanguagePair: null,
        totalCharactersTranslated: 0
      });
    });
  });

  describe('getStats', () => {
    const sampleStats = {
      totalTranslations: 42,
      firstTranslationDate: Date.now() - 86400000,
      lastTranslationDate: Date.now(),
      mostUsedLanguagePair: 'en-ja',
      totalCharactersTranslated: 1234
    };

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'stats') return sampleStats;
        return null;
      });
    });

    test('should return statistics', async () => {
      const result = await historyStore.getStats();

      expect(result).toEqual(sampleStats);
    });

    test('should calculate additional metrics', async () => {
      const result = await historyStore.getStats();

      expect(result.averageTranslationLength).toBeDefined();
      expect(result.translationsPerDay).toBeDefined();
    });
  });

  describe('exportHistory', () => {
    const sampleHistory = [
      {
        id: 'id-1',
        originalText: 'Hello',
        translatedText: 'こんにちは',
        timestamp: Date.now(),
        sourceLang: 'en',
        targetLang: 'ja'
      }
    ];

    beforeEach(() => {
      mockStore.get.mockImplementation((key) => {
        if (key === 'history') return sampleHistory;
        if (key === 'stats') return { totalTranslations: 1 };
        return null;
      });
    });

    test('should export history as JSON', async () => {
      const result = await historyStore.exportHistory('json');

      const exported = JSON.parse(result);
      expect(exported.history).toHaveLength(1);
      expect(exported.stats).toBeDefined();
      expect(exported.exportDate).toBeDefined();
    });

    test('should export history as CSV', async () => {
      const result = await historyStore.exportHistory('csv');

      expect(result).toContain('originalText,translatedText,sourceLang,targetLang,timestamp');
      expect(result).toContain('Hello,こんにちは,en,ja');
    });

    test('should handle unsupported format', async () => {
      await expect(historyStore.exportHistory('xml'))
        .rejects.toThrow('Unsupported export format');
    });
  });

  describe('importHistory', () => {
    test('should import JSON history data', async () => {
      const importData = JSON.stringify({
        history: [
          {
            originalText: 'Import test',
            translatedText: 'インポートテスト',
            sourceLang: 'en',
            targetLang: 'ja',
            timestamp: Date.now()
          }
        ],
        version: '1.0.0'
      });

      mockStore.get.mockReturnValue([]);

      const result = await historyStore.importHistory(importData);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate imported data', async () => {
      const invalidData = JSON.stringify({
        history: [
          {
            originalText: '', // Invalid: empty text
            translatedText: 'Test'
          }
        ]
      });

      mockStore.get.mockReturnValue([]);

      const result = await historyStore.importHistory(invalidData);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    test('should handle malformed JSON', async () => {
      const malformedData = '{ invalid json }';

      await expect(historyStore.importHistory(malformedData))
        .rejects.toThrow('Invalid JSON format');
    });
  });

  describe('_buildSearchIndex', () => {
    test('should build search index from history', () => {
      const history = [
        { id: 'id-1', originalText: 'Hello World', translatedText: 'こんにちは世界' },
        { id: 'id-2', originalText: 'Good morning', translatedText: 'おはよう' }
      ];

      const index = historyStore._buildSearchIndex(history);

      expect(index.hello).toContain('id-1');
      expect(index.world).toContain('id-1');
      expect(index['こんにちは']).toContain('id-1');
      expect(index.good).toContain('id-2');
      expect(index.morning).toContain('id-2');
    });

    test('should handle empty history', () => {
      const index = historyStore._buildSearchIndex([]);

      expect(Object.keys(index)).toHaveLength(0);
    });
  });

  describe('_validateTranslation', () => {
    test('should validate required fields', () => {
      expect(() => historyStore._validateTranslation({
        originalText: 'Hello',
        translatedText: 'こんにちは'
      })).not.toThrow();
    });

    test('should throw for missing original text', () => {
      expect(() => historyStore._validateTranslation({
        translatedText: 'こんにちは'
      })).toThrow('Original text is required');
    });

    test('should throw for missing translated text', () => {
      expect(() => historyStore._validateTranslation({
        originalText: 'Hello'
      })).toThrow('Translated text is required');
    });

    test('should throw for empty strings', () => {
      expect(() => historyStore._validateTranslation({
        originalText: '',
        translatedText: 'こんにちは'
      })).toThrow('Original text is required');
    });
  });

  describe('cleanup', () => {
    test('should clean up resources', () => {
      expect(() => historyStore.cleanup()).not.toThrow();
    });
  });
});