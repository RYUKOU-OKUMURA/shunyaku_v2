/**
 * TranslationHistoryStore.js
 * Shunyaku v2 翻訳履歴管理システム
 *
 * このクラスは翻訳履歴の永続化・管理を行います。
 * electron-store を使用して履歴の保存、検索、削除、件数制限を実装します。
 */

const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

/**
 * 翻訳履歴のスキーマ定義
 */
const HISTORY_SCHEMA = {
  version: {
    type: 'string',
    default: '1.0.0',
  },
  maxItems: {
    type: 'number',
    minimum: 1,
    maximum: 1000,
    default: 100,
  },
  items: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        timestamp: { type: 'string' },
        originalText: { type: 'string' },
        translatedText: { type: 'string' },
        sourceLanguage: { type: 'string' },
        targetLanguage: { type: 'string' },
        confidence: { type: 'number' },
        workflowId: { type: 'string' },
        triggerMethod: { type: 'string' },
        favorite: { type: 'boolean' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: [
        'id',
        'timestamp',
        'originalText',
        'translatedText',
        'sourceLanguage',
        'targetLanguage',
      ],
    },
    default: [],
  },
  stats: {
    type: 'object',
    properties: {
      totalTranslations: { type: 'number', default: 0 },
      lastUsed: { type: 'string' },
      mostUsedSourceLanguage: { type: 'string' },
      mostUsedTargetLanguage: { type: 'string' },
    },
    default: {
      totalTranslations: 0,
      lastUsed: null,
      mostUsedSourceLanguage: null,
      mostUsedTargetLanguage: null,
    },
  },
};

/**
 * TranslationHistoryStore クラス
 * 翻訳履歴の管理を行うメインクラス
 */
class TranslationHistoryStore {
  /**
   * コンストラクタ
   * @param {Object} options - electron-storeのオプション
   */
  constructor(options = {}) {
    // electron-store の初期化
    this.store = new Store({
      name: 'shunyaku-translation-history',
      schema: HISTORY_SCHEMA,
      defaults: {
        version: '1.0.0',
        maxItems: 100,
        items: [],
        stats: {
          totalTranslations: 0,
          lastUsed: null,
          mostUsedSourceLanguage: null,
          mostUsedTargetLanguage: null,
        },
      },
      clearInvalidConfig: true,
      accessPropertiesByDotNotation: true,
      ...options,
    });

    // 変更イベントリスナーを格納する配列
    this.listeners = [];

    // electron-storeの変更イベントをラップ
    this.store.onDidAnyChange((newValue, oldValue) => {
      this.listeners.forEach((listener) => {
        try {
          listener(newValue, oldValue);
        } catch (error) {
          console.error('Translation history change listener error:', error);
        }
      });
    });
  }

  /**
   * 翻訳履歴を追加
   * @param {Object} translationData - 翻訳データ
   * @param {string} translationData.originalText - 原文
   * @param {string} translationData.translatedText - 翻訳文
   * @param {string} translationData.sourceLanguage - 元言語
   * @param {string} translationData.targetLanguage - 対象言語
   * @param {number} [translationData.confidence] - 信頼度（OCRの場合）
   * @param {string} [translationData.workflowId] - ワークフローID
   * @param {string} [translationData.triggerMethod] - トリガー方法
   * @returns {string} 追加されたアイテムのID
   */
  addTranslation(translationData) {
    try {
      const historyItem = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        originalText: translationData.originalText,
        translatedText: translationData.translatedText,
        sourceLanguage: translationData.sourceLanguage,
        targetLanguage: translationData.targetLanguage,
        confidence: translationData.confidence || null,
        workflowId: translationData.workflowId || null,
        triggerMethod: translationData.triggerMethod || 'manual',
        favorite: false,
        tags: [],
      };

      // バリデーション
      if (!historyItem.originalText || !historyItem.translatedText) {
        throw new Error('Original text and translated text are required');
      }

      const items = this.store.get('items', []);

      // 重複チェック（同じ原文・訳文・言語ペアの最新5分以内の履歴をチェック）
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const isDuplicate = items.some(
        (item) =>
          item.originalText === historyItem.originalText &&
          item.translatedText === historyItem.translatedText &&
          item.sourceLanguage === historyItem.sourceLanguage &&
          item.targetLanguage === historyItem.targetLanguage &&
          item.timestamp > fiveMinutesAgo,
      );

      if (isDuplicate) {
        console.log('Duplicate translation detected within 5 minutes, skipping...');
        return null;
      }

      // 新しいアイテムを先頭に追加（最新が上）
      const updatedItems = [historyItem, ...items];

      // 件数制限をチェックして超過分を削除
      const maxItems = this.store.get('maxItems', 100);
      if (updatedItems.length > maxItems) {
        updatedItems.splice(maxItems);
      }

      // 履歴を更新
      this.store.set('items', updatedItems);

      // 統計を更新
      this.updateStats(historyItem);

      console.log(
        `Translation history added: ${historyItem.id} (${historyItem.sourceLanguage} → ${historyItem.targetLanguage})`,
      );

      return historyItem.id;
    } catch (error) {
      console.error('Failed to add translation history:', error);
      throw error;
    }
  }

  /**
   * 翻訳履歴を取得
   * @param {Object} options - 取得オプション
   * @param {number} [options.limit] - 取得件数制限
   * @param {number} [options.offset] - オフセット
   * @param {string} [options.sortBy] - ソート基準 ('timestamp', 'confidence')
   * @param {string} [options.sortOrder] - ソート順 ('asc', 'desc')
   * @param {boolean} [options.favoritesOnly] - お気に入りのみ
   * @returns {Array} 履歴アイテムの配列
   */
  getTranslations(options = {}) {
    try {
      const {
        limit = null,
        offset = 0,
        sortBy = 'timestamp',
        sortOrder = 'desc',
        favoritesOnly = false,
      } = options;

      let items = this.store.get('items', []);

      // お気に入りフィルター
      if (favoritesOnly) {
        items = items.filter((item) => item.favorite);
      }

      // ソート
      items.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (sortBy === 'timestamp') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      // オフセット適用
      if (offset > 0) {
        items = items.slice(offset);
      }

      // リミット適用
      if (limit && limit > 0) {
        items = items.slice(0, limit);
      }

      return items;
    } catch (error) {
      console.error('Failed to get translation history:', error);
      return [];
    }
  }

  /**
   * 履歴を検索
   * @param {string} query - 検索クエリ
   * @param {Object} options - 検索オプション
   * @param {Array<string>} [options.searchFields] - 検索対象フィールド
   * @param {boolean} [options.caseSensitive] - 大文字小文字を区別するか
   * @param {string} [options.sourceLanguage] - 元言語フィルター
   * @param {string} [options.targetLanguage] - 対象言語フィルター
   * @returns {Array} マッチした履歴アイテムの配列
   */
  searchTranslations(query, options = {}) {
    try {
      const {
        searchFields = ['originalText', 'translatedText'],
        caseSensitive = false,
        sourceLanguage = null,
        targetLanguage = null,
      } = options;

      if (!query || query.trim().length === 0) {
        return this.getTranslations();
      }

      const searchQuery = caseSensitive ? query : query.toLowerCase();
      const items = this.store.get('items', []);

      const filteredItems = items.filter((item) => {
        // 言語フィルター
        if (sourceLanguage && item.sourceLanguage !== sourceLanguage) {
          return false;
        }
        if (targetLanguage && item.targetLanguage !== targetLanguage) {
          return false;
        }

        // テキスト検索
        return searchFields.some((field) => {
          const fieldValue = item[field];
          if (!fieldValue) {
            return false;
          }

          const searchText = caseSensitive ? fieldValue : fieldValue.toLowerCase();
          return searchText.includes(searchQuery);
        });
      });

      // タイムスタンプ順（新しい順）でソート
      filteredItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return filteredItems;
    } catch (error) {
      console.error('Failed to search translation history:', error);
      return [];
    }
  }

  /**
   * 履歴アイテムを削除
   * @param {string} id - アイテムID
   * @returns {boolean} 削除が成功したか
   */
  deleteTranslation(id) {
    try {
      const items = this.store.get('items', []);
      const itemIndex = items.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        return false;
      }

      items.splice(itemIndex, 1);
      this.store.set('items', items);

      console.log(`Translation history deleted: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete translation history:', error);
      return false;
    }
  }

  /**
   * 複数の履歴アイテムを削除
   * @param {Array<string>} ids - アイテムIDの配列
   * @returns {Object} 削除結果
   */
  deleteTranslations(ids) {
    try {
      const items = this.store.get('items', []);
      const originalCount = items.length;

      const filteredItems = items.filter((item) => !ids.includes(item.id));
      const deletedCount = originalCount - filteredItems.length;

      this.store.set('items', filteredItems);

      console.log(`Translation history batch delete: ${deletedCount}/${ids.length} items deleted`);

      return {
        success: true,
        deletedCount: deletedCount,
        requestedCount: ids.length,
      };
    } catch (error) {
      console.error('Failed to delete multiple translation histories:', error);
      return {
        success: false,
        deletedCount: 0,
        requestedCount: ids.length,
        error: error.message,
      };
    }
  }

  /**
   * お気に入り状態を切り替え
   * @param {string} id - アイテムID
   * @returns {boolean} 新しいお気に入り状態
   */
  toggleFavorite(id) {
    try {
      const items = this.store.get('items', []);
      const item = items.find((item) => item.id === id);

      if (!item) {
        throw new Error(`Translation history not found: ${id}`);
      }

      item.favorite = !item.favorite;
      this.store.set('items', items);

      console.log(`Translation history favorite toggled: ${id} -> ${item.favorite}`);
      return item.favorite;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  }

  /**
   * 履歴をクリア
   * @param {Object} options - クリアオプション
   * @param {boolean} [options.keepFavorites] - お気に入りを保持するか
   * @param {number} [options.keepDays] - 指定日数以内のものを保持
   */
  clearHistory(options = {}) {
    try {
      const { keepFavorites = false, keepDays = null } = options;

      let items = this.store.get('items', []);

      if (keepFavorites || keepDays !== null) {
        const cutoffDate = keepDays ? new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000) : null;

        items = items.filter((item) => {
          if (keepFavorites && item.favorite) {
            return true;
          }
          if (keepDays && new Date(item.timestamp) > cutoffDate) {
            return true;
          }
          return false;
        });
      } else {
        items = [];
      }

      this.store.set('items', items);

      // 統計をリセット（部分削除の場合は再計算）
      if (items.length === 0) {
        this.resetStats();
      } else {
        this.recalculateStats();
      }

      console.log(`Translation history cleared (${items.length} items retained)`);
    } catch (error) {
      console.error('Failed to clear translation history:', error);
      throw error;
    }
  }

  /**
   * 履歴件数を取得
   * @returns {number} 履歴件数
   */
  getHistoryCount() {
    try {
      return this.store.get('items', []).length;
    } catch (error) {
      console.error('Failed to get history count:', error);
      return 0;
    }
  }

  /**
   * 最大保存件数を設定
   * @param {number} maxItems - 最大件数
   */
  setMaxItems(maxItems) {
    try {
      if (maxItems < 1 || maxItems > 1000) {
        throw new Error('Max items must be between 1 and 1000');
      }

      const currentMaxItems = this.store.get('maxItems', 100);
      this.store.set('maxItems', maxItems);

      // 現在の件数が新しい上限を超えている場合は削除
      if (maxItems < currentMaxItems) {
        const items = this.store.get('items', []);
        if (items.length > maxItems) {
          const trimmedItems = items.slice(0, maxItems);
          this.store.set('items', trimmedItems);
          console.log(`Translation history trimmed to ${maxItems} items`);
        }
      }

      console.log(`Max translation history items set to: ${maxItems}`);
    } catch (error) {
      console.error('Failed to set max items:', error);
      throw error;
    }
  }

  /**
   * 統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    try {
      return this.store.get('stats', {
        totalTranslations: 0,
        lastUsed: null,
        mostUsedSourceLanguage: null,
        mostUsedTargetLanguage: null,
      });
    } catch (error) {
      console.error('Failed to get translation history stats:', error);
      return {
        totalTranslations: 0,
        lastUsed: null,
        mostUsedSourceLanguage: null,
        mostUsedTargetLanguage: null,
      };
    }
  }

  /**
   * 統計情報を更新
   * @param {Object} newItem - 新しく追加されたアイテム
   * @private
   */
  updateStats(newItem) {
    try {
      const stats = this.getStats();
      const items = this.store.get('items', []);

      // 総翻訳数を更新
      stats.totalTranslations = items.length;
      stats.lastUsed = newItem.timestamp;

      // 最も使われている言語を計算
      const sourceLanguageCounts = {};
      const targetLanguageCounts = {};

      items.forEach((item) => {
        sourceLanguageCounts[item.sourceLanguage] =
          (sourceLanguageCounts[item.sourceLanguage] || 0) + 1;
        targetLanguageCounts[item.targetLanguage] =
          (targetLanguageCounts[item.targetLanguage] || 0) + 1;
      });

      // 最多使用言語を特定
      stats.mostUsedSourceLanguage =
        Object.entries(sourceLanguageCounts).reduce(
          (a, b) => (sourceLanguageCounts[a[0]] > sourceLanguageCounts[b[0]] ? a : b),
          ['', 0],
        )[0] || null;

      stats.mostUsedTargetLanguage =
        Object.entries(targetLanguageCounts).reduce(
          (a, b) => (targetLanguageCounts[a[0]] > targetLanguageCounts[b[0]] ? a : b),
          ['', 0],
        )[0] || null;

      this.store.set('stats', stats);
    } catch (error) {
      console.error('Failed to update translation history stats:', error);
    }
  }

  /**
   * 統計情報を再計算
   * @private
   */
  recalculateStats() {
    try {
      const items = this.store.get('items', []);

      if (items.length === 0) {
        this.resetStats();
        return;
      }

      // 最新のアイテムから統計を更新
      const latestItem = items.reduce((latest, item) =>
        new Date(item.timestamp) > new Date(latest.timestamp) ? item : latest,
      );

      this.updateStats(latestItem);
    } catch (error) {
      console.error('Failed to recalculate translation history stats:', error);
    }
  }

  /**
   * 統計情報をリセット
   * @private
   */
  resetStats() {
    try {
      this.store.set('stats', {
        totalTranslations: 0,
        lastUsed: null,
        mostUsedSourceLanguage: null,
        mostUsedTargetLanguage: null,
      });
    } catch (error) {
      console.error('Failed to reset translation history stats:', error);
    }
  }

  /**
   * 変更イベントリスナーを追加
   * @param {Function} listener - リスナー関数
   * @returns {Function} リスナー削除用関数
   */
  onChange(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);

      // リスナー削除用関数を返す
      return () => {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      };
    }

    throw new Error('Listener must be a function');
  }

  /**
   * データをエクスポート
   * @returns {Object} エクスポートされたデータ
   */
  exportData() {
    try {
      return {
        version: this.store.get('version', '1.0.0'),
        timestamp: new Date().toISOString(),
        maxItems: this.store.get('maxItems', 100),
        items: this.store.get('items', []),
        stats: this.store.get('stats', {}),
      };
    } catch (error) {
      console.error('Failed to export translation history:', error);
      throw error;
    }
  }

  /**
   * データをインポート
   * @param {Object} data - インポートするデータ
   * @param {boolean} merge - 既存データとマージするか
   */
  importData(data, merge = false) {
    try {
      if (!data || !data.items) {
        throw new Error('Invalid import data format');
      }

      if (merge) {
        // 既存データとマージ
        const existingItems = this.store.get('items', []);
        const existingIds = new Set(existingItems.map((item) => item.id));

        const newItems = data.items.filter((item) => !existingIds.has(item.id));
        const mergedItems = [...existingItems, ...newItems];

        // 件数制限を適用
        const maxItems = this.store.get('maxItems', 100);
        if (mergedItems.length > maxItems) {
          // タイムスタンプ順にソートして最新のものを保持
          mergedItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          mergedItems.splice(maxItems);
        }

        this.store.set('items', mergedItems);
      } else {
        // 完全置き換え
        this.store.set('items', data.items.slice(0, this.store.get('maxItems', 100)));
        if (data.maxItems) {
          this.store.set('maxItems', data.maxItems);
        }
      }

      // 統計を再計算
      this.recalculateStats();

      console.log(`Translation history imported: ${data.items.length} items`);
    } catch (error) {
      console.error('Failed to import translation history:', error);
      throw error;
    }
  }

  /**
   * ストレージパスを取得
   * @returns {string} ストレージファイルのパス
   */
  getStorePath() {
    return this.store.path;
  }

  /**
   * リソースのクリーンアップ
   */
  destroy() {
    try {
      // リスナーをクリア
      this.listeners.length = 0;

      // ストアの参照をクリア
      this.store = null;
    } catch (error) {
      console.error('Translation history store destroy error:', error);
    }
  }
}

module.exports = TranslationHistoryStore;
