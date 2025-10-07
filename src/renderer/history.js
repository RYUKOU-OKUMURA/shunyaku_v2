/**
 * history.js
 * Shunyaku v2 Translation History UI Logic
 *
 * このファイルは翻訳履歴の表示、検索、削除、管理機能を実装します。
 */

// === STATE MANAGEMENT ===
const state = {
  currentHistory: [],
  filteredHistory: [],
  selectedItems: new Set(),
  currentPage: 1,
  itemsPerPage: 20,
  sortBy: 'timestamp',
  sortOrder: 'desc',
  searchQuery: '',
  filters: {
    language: '',
    date: '',
    type: '',
  },
  viewMode: 'list', // 'list' or 'grid'
  isLoading: false,
};

// === UTILITY FUNCTIONS ===

/**
 * 日付を相対表現でフォーマット
 */
function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('ja-JP');
  }
}

/**
 * 完全なタイムスタンプをフォーマット
 */
function formatFullTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 言語コードを表示名に変換
 */
function getLanguageDisplayName(langCode) {
  const languages = {
    auto: 'Auto',
    en: 'EN',
    ja: 'JA',
    ko: 'KO',
    zh: 'ZH',
    es: 'ES',
    fr: 'FR',
    de: 'DE',
    it: 'IT',
    pt: 'PT',
    ru: 'RU',
  };
  return languages[langCode] || langCode.toUpperCase();
}

/**
 * 信頼度を表示形式でフォーマット
 */
function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined) {
    return '';
  }
  return `${Math.round(confidence)}%`;
}

/**
 * 日付フィルターに基づいて日付範囲を計算
 */
function getDateRange(filter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
  case 'today':
    return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };

  case 'week': {
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start: weekStart, end: now };
  }

  case 'month': {
    const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start: monthStart, end: now };
  }

  case 'year': {
    const yearStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    return { start: yearStart, end: now };
  }

  default:
    return null;
  }
}

/**
 * ステータスメッセージを表示
 */
function showStatusMessage(message, type = 'info') {
  const container = document.getElementById('status-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `status-message ${type}`;
  messageDiv.textContent = message;

  container.appendChild(messageDiv);

  // 3秒後に自動削除
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 3000);
}

/**
 * 確認ダイアログを表示
 */
function showConfirmationDialog(title, message, confirmText = 'Confirm') {
  return new Promise((resolve) => {
    const template = document.getElementById('confirmation-dialog-template');
    const dialog = template.content.cloneNode(true);

    dialog.querySelector('.modal-title').textContent = title;
    dialog.querySelector('.modal-message').textContent = message;
    dialog.querySelector('.modal-confirm').textContent = confirmText;

    const overlay = dialog.querySelector('.modal-overlay');
    document.body.appendChild(overlay);

    const handleConfirm = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };

    const handleCancel = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    overlay.querySelector('.modal-confirm').addEventListener('click', handleConfirm);
    overlay.querySelector('.modal-cancel').addEventListener('click', handleCancel);
    overlay.querySelector('.modal-close').addEventListener('click', handleCancel);

    // ESCキーでキャンセル
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleKeydown);
        handleCancel();
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

// === DATA MANAGEMENT ===

/**
 * 履歴データを読み込み
 */
async function loadHistoryData() {
  try {
    state.isLoading = true;
    updateLoadingState();

    const result = await window.electronAPI.getTranslationHistory();

    if (result.success) {
      state.currentHistory = result.history || [];
      updateHeaderStats();
      await loadHistoryStats();
      applyFilters();
    } else {
      throw new Error(result.error || 'Failed to load history');
    }
  } catch (error) {
    console.error('Failed to load history:', error);
    showStatusMessage('Failed to load translation history', 'error');
    state.currentHistory = [];
    state.filteredHistory = [];
  } finally {
    state.isLoading = false;
    updateLoadingState();
  }
}

/**
 * 履歴統計を読み込み
 */
async function loadHistoryStats() {
  try {
    const result = await window.electronAPI.getTranslationHistoryStats();

    if (result.success) {
      updateStatsDisplay(result.stats);
    }
  } catch (error) {
    console.error('Failed to load history stats:', error);
  }
}

/**
 * フィルターと検索を適用
 */
function applyFilters() {
  let filtered = [...state.currentHistory];

  // テキスト検索
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.originalText.toLowerCase().includes(query) ||
        item.translatedText.toLowerCase().includes(query),
    );
  }

  // 言語フィルター
  if (state.filters.language) {
    const [source, target] = state.filters.language.split('-');
    filtered = filtered.filter(
      (item) => item.sourceLanguage === source && item.targetLanguage === target,
    );
  }

  // 日付フィルター
  if (state.filters.date) {
    const dateRange = getDateRange(state.filters.date);
    if (dateRange) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
      });
    }
  }

  // タイプフィルター
  if (state.filters.type) {
    if (state.filters.type === 'favorites') {
      filtered = filtered.filter((item) => item.favorite);
    } else {
      filtered = filtered.filter((item) => item.triggerMethod === state.filters.type);
    }
  }

  // ソート
  filtered.sort((a, b) => {
    let aValue = a[state.sortBy];
    let bValue = b[state.sortBy];

    if (state.sortBy === 'timestamp') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (state.sortOrder === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  state.filteredHistory = filtered;
  state.currentPage = 1;
  updateHistoryDisplay();
}

// === UI UPDATE FUNCTIONS ===

/**
 * ヘッダー統計を更新
 */
function updateHeaderStats() {
  const countElement = document.getElementById('history-count');
  const lastUpdatedElement = document.getElementById('last-updated');

  const count = state.currentHistory.length;
  countElement.textContent = `${count} translation${count !== 1 ? 's' : ''}`;

  if (count > 0) {
    const latest = state.currentHistory[0];
    lastUpdatedElement.textContent = `Last used: ${formatRelativeTime(latest.timestamp)}`;
  } else {
    lastUpdatedElement.textContent = 'Never used';
  }
}

/**
 * 統計表示を更新
 */
function updateStatsDisplay(stats) {
  document.getElementById('total-translations').textContent = stats.totalTranslations || 0;
  document.getElementById('most-used-source').textContent = stats.mostUsedSourceLanguage
    ? getLanguageDisplayName(stats.mostUsedSourceLanguage)
    : '-';
  document.getElementById('most-used-target').textContent = stats.mostUsedTargetLanguage
    ? getLanguageDisplayName(stats.mostUsedTargetLanguage)
    : '-';

  // 平均信頼度を計算
  const confidenceScores = state.currentHistory
    .map((item) => item.confidence)
    .filter((confidence) => confidence !== null && confidence !== undefined);

  if (confidenceScores.length > 0) {
    const avgConfidence =
      confidenceScores.reduce((sum, confidence) => sum + confidence, 0) / confidenceScores.length;
    document.getElementById('avg-confidence').textContent = `${Math.round(avgConfidence)}%`;
  } else {
    document.getElementById('avg-confidence').textContent = '-';
  }
}

/**
 * 読み込み状態を更新
 */
function updateLoadingState() {
  const loadingElement = document.getElementById('loading-state');
  const historyListElement = document.getElementById('history-list');
  const emptyStateElement = document.getElementById('empty-state');
  const noResultsElement = document.getElementById('no-results');

  if (state.isLoading) {
    loadingElement.style.display = 'flex';
    historyListElement.style.display = 'none';
    emptyStateElement.style.display = 'none';
    noResultsElement.style.display = 'none';
  } else {
    loadingElement.style.display = 'none';
    updateHistoryDisplay();
  }
}

/**
 * 履歴表示を更新
 */
function updateHistoryDisplay() {
  const historyListElement = document.getElementById('history-list');
  const emptyStateElement = document.getElementById('empty-state');
  const noResultsElement = document.getElementById('no-results');

  // 表示状態を決定
  if (state.currentHistory.length === 0) {
    // 履歴が全くない場合
    historyListElement.style.display = 'none';
    emptyStateElement.style.display = 'flex';
    noResultsElement.style.display = 'none';
    updatePagination();
    return;
  }

  if (state.filteredHistory.length === 0) {
    // フィルタリング結果が空の場合
    historyListElement.style.display = 'none';
    emptyStateElement.style.display = 'none';
    noResultsElement.style.display = 'flex';
    updatePagination();
    return;
  }

  // 履歴アイテムを表示
  emptyStateElement.style.display = 'none';
  noResultsElement.style.display = 'none';
  historyListElement.style.display = 'flex';

  // ページネーション
  const startIndex = (state.currentPage - 1) * state.itemsPerPage;
  const endIndex = startIndex + state.itemsPerPage;
  const pageItems = state.filteredHistory.slice(startIndex, endIndex);

  // 履歴アイテムをレンダリング
  historyListElement.innerHTML = '';
  pageItems.forEach((item) => {
    const itemElement = createHistoryItemElement(item);
    historyListElement.appendChild(itemElement);
  });

  updatePagination();
  updateSelectionUI();
}

/**
 * 履歴アイテム要素を作成
 */
function createHistoryItemElement(item) {
  const template = document.getElementById('history-item-template');
  const element = template.content.cloneNode(true);
  const container = element.querySelector('.history-item');

  // 基本データを設定
  container.setAttribute('data-id', item.id);
  if (item.favorite) {
    container.classList.add('favorite');
  }

  // チェックボックス
  const checkbox = element.querySelector('.item-select');
  checkbox.checked = state.selectedItems.has(item.id);
  checkbox.addEventListener('change', (e) => {
    handleItemSelection(item.id, e.target.checked);
  });

  // メタ情報
  element.querySelector('.item-timestamp').textContent = formatRelativeTime(item.timestamp);
  element.querySelector('.item-languages').textContent =
    `${getLanguageDisplayName(item.sourceLanguage)} → ${getLanguageDisplayName(item.targetLanguage)}`;

  const confidenceElement = element.querySelector('.item-confidence');
  if (item.confidence) {
    confidenceElement.textContent = formatConfidence(item.confidence);
  } else {
    confidenceElement.style.display = 'none';
  }

  // テキスト内容
  element.querySelector('.original-text .text-value').textContent = item.originalText;
  element.querySelector('.translated-text .text-value').textContent = item.translatedText;

  // 詳細情報
  element.querySelector('.workflow-id').textContent = item.workflowId || 'N/A';
  element.querySelector('.trigger-method').textContent = item.triggerMethod || 'manual';
  element.querySelector('.full-timestamp').textContent = formatFullTimestamp(item.timestamp);

  // アクションボタン
  const favoriteBtn = element.querySelector('.favorite-btn');
  if (item.favorite) {
    favoriteBtn.classList.add('active');
    favoriteBtn.querySelector('.btn-icon').textContent = '★';
  }
  favoriteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleToggleFavorite(item.id);
  });

  const copyBtn = element.querySelector('.copy-btn');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCopyTranslation(item.translatedText);
  });

  const deleteBtn = element.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteItem(item.id);
  });

  // 詳細切り替え
  const toggleBtn = element.querySelector('.item-toggle-details');
  const detailsElement = element.querySelector('.item-details');
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = toggleBtn.classList.contains('expanded');

    if (isExpanded) {
      toggleBtn.classList.remove('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Show details';
      detailsElement.style.display = 'none';
    } else {
      toggleBtn.classList.add('expanded');
      toggleBtn.querySelector('.toggle-text').textContent = 'Hide details';
      detailsElement.style.display = 'block';
    }
  });

  return element;
}

/**
 * ページネーションを更新
 */
function updatePagination() {
  const paginationElement = document.getElementById('pagination');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');

  const totalPages = Math.ceil(state.filteredHistory.length / state.itemsPerPage);

  if (totalPages <= 1) {
    paginationElement.style.display = 'none';
    return;
  }

  paginationElement.style.display = 'flex';
  pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;

  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= totalPages;
}

/**
 * 選択状態のUIを更新
 */
function updateSelectionUI() {
  const selectAllCheckbox = document.getElementById('select-all');
  const selectionCountElement = document.getElementById('selection-count');
  const deleteSelectedBtn = document.getElementById('delete-selected');
  const exportSelectedBtn = document.getElementById('export-selected');

  const selectedCount = state.selectedItems.size;
  const totalCount = state.filteredHistory.length;

  // 全選択チェックボックス
  if (selectedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedCount === totalCount) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }

  // 選択数表示
  selectionCountElement.textContent = `${selectedCount} selected`;

  // ボタン状態
  deleteSelectedBtn.disabled = selectedCount === 0;
  exportSelectedBtn.disabled = selectedCount === 0;
}

// === EVENT HANDLERS ===

/**
 * アイテム選択処理
 */
function handleItemSelection(itemId, selected) {
  if (selected) {
    state.selectedItems.add(itemId);
  } else {
    state.selectedItems.delete(itemId);
  }

  updateSelectionUI();

  // アイテムの視覚的状態を更新
  const itemElement = document.querySelector(`.history-item[data-id="${itemId}"]`);
  if (itemElement) {
    if (selected) {
      itemElement.classList.add('selected');
    } else {
      itemElement.classList.remove('selected');
    }
  }
}

/**
 * 全選択切り替え処理
 */
function handleSelectAll(selectAll) {
  const currentPageItems = state.filteredHistory.slice(
    (state.currentPage - 1) * state.itemsPerPage,
    state.currentPage * state.itemsPerPage,
  );

  currentPageItems.forEach((item) => {
    if (selectAll) {
      state.selectedItems.add(item.id);
    } else {
      state.selectedItems.delete(item.id);
    }
  });

  // すべてのアイテムチェックボックスを更新
  document.querySelectorAll('.item-select').forEach((checkbox) => {
    const itemId = checkbox.closest('.history-item').getAttribute('data-id');
    checkbox.checked = state.selectedItems.has(itemId);
    handleItemSelection(itemId, checkbox.checked);
  });

  updateSelectionUI();
}

/**
 * お気に入り切り替え処理
 */
async function handleToggleFavorite(itemId) {
  try {
    const result = await window.electronAPI.toggleTranslationFavorite(itemId);

    if (result.success) {
      // 履歴データを更新
      const item = state.currentHistory.find((item) => item.id === itemId);
      if (item) {
        item.favorite = result.favorite;
      }

      // UIを更新
      const itemElement = document.querySelector(`.history-item[data-id="${itemId}"]`);
      const favoriteBtn = itemElement?.querySelector('.favorite-btn');

      if (favoriteBtn) {
        if (result.favorite) {
          favoriteBtn.classList.add('active');
          favoriteBtn.querySelector('.btn-icon').textContent = '★';
          itemElement.classList.add('favorite');
        } else {
          favoriteBtn.classList.remove('active');
          favoriteBtn.querySelector('.btn-icon').textContent = '☆';
          itemElement.classList.remove('favorite');
        }
      }

      showStatusMessage(
        result.favorite ? 'Added to favorites' : 'Removed from favorites',
        'success',
      );
    } else {
      throw new Error(result.error || 'Failed to toggle favorite');
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    showStatusMessage('Failed to update favorite status', 'error');
  }
}

/**
 * 翻訳文コピー処理
 */
async function handleCopyTranslation(text) {
  try {
    await navigator.clipboard.writeText(text);
    showStatusMessage('Translation copied to clipboard', 'success');
  } catch (error) {
    console.error('Failed to copy text:', error);
    showStatusMessage('Failed to copy text', 'error');
  }
}

/**
 * 単一アイテム削除処理
 */
async function handleDeleteItem(itemId) {
  const confirmed = await showConfirmationDialog(
    'Delete Translation',
    'Are you sure you want to delete this translation? This action cannot be undone.',
    'Delete',
  );

  if (!confirmed) {
    return;
  }

  try {
    const result = await window.electronAPI.deleteTranslationHistory(itemId);

    if (result.success) {
      // 履歴データから削除
      state.currentHistory = state.currentHistory.filter((item) => item.id !== itemId);
      state.selectedItems.delete(itemId);

      applyFilters();
      updateHeaderStats();
      showStatusMessage('Translation deleted', 'success');
    } else {
      throw new Error(result.error || 'Failed to delete translation');
    }
  } catch (error) {
    console.error('Failed to delete translation:', error);
    showStatusMessage('Failed to delete translation', 'error');
  }
}

/**
 * 複数アイテム削除処理
 */
async function handleDeleteSelected() {
  if (state.selectedItems.size === 0) {
    return;
  }

  const confirmed = await showConfirmationDialog(
    'Delete Selected Translations',
    `Are you sure you want to delete ${state.selectedItems.size} translation(s)? This action cannot be undone.`,
    'Delete All',
  );

  if (!confirmed) {
    return;
  }

  try {
    const itemIds = Array.from(state.selectedItems);
    const result = await window.electronAPI.deleteTranslationHistories(itemIds);

    if (result.success) {
      // 履歴データから削除
      const deletedIds = new Set(itemIds);
      state.currentHistory = state.currentHistory.filter((item) => !deletedIds.has(item.id));
      state.selectedItems.clear();

      applyFilters();
      updateHeaderStats();
      showStatusMessage(
        `${result.deletedCount} translation${result.deletedCount !== 1 ? 's' : ''} deleted`,
        'success',
      );
    } else {
      throw new Error(result.error || 'Failed to delete translations');
    }
  } catch (error) {
    console.error('Failed to delete translations:', error);
    showStatusMessage('Failed to delete translations', 'error');
  }
}

/**
 * 検索処理
 */
function handleSearch() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');

  state.searchQuery = searchInput.value.trim();
  clearBtn.disabled = state.searchQuery === '';

  applyFilters();
}

/**
 * 検索クリア処理
 */
function handleClearSearch() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');

  searchInput.value = '';
  state.searchQuery = '';
  clearBtn.disabled = true;

  applyFilters();
}

/**
 * フィルタークリア処理
 */
function handleClearFilters() {
  // フィルター要素をリセット
  document.getElementById('language-filter').value = '';
  document.getElementById('date-filter').value = '';
  document.getElementById('type-filter').value = '';

  // 検索もクリア
  handleClearSearch();

  // 状態をリセット
  state.filters = {
    language: '',
    date: '',
    type: '',
  };

  applyFilters();
}

/**
 * エクスポート処理
 */
async function handleExport(selectedOnly = false) {
  try {
    const itemsToExport = selectedOnly
      ? state.currentHistory.filter((item) => state.selectedItems.has(item.id))
      : state.currentHistory;

    if (itemsToExport.length === 0) {
      showStatusMessage('No items to export', 'warning');
      return;
    }

    const result = await window.electronAPI.exportTranslationHistory(itemsToExport);

    if (result.success) {
      showStatusMessage(
        `${itemsToExport.length} translation${itemsToExport.length !== 1 ? 's' : ''} exported to ${result.filePath}`,
        'success',
      );
    } else {
      throw new Error(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('Export failed:', error);
    showStatusMessage('Export failed', 'error');
  }
}

/**
 * インポート処理
 */
async function handleImport() {
  try {
    const fileInput = document.getElementById('import-file-input');
    fileInput.click();

    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      if (!file.name.endsWith('.json')) {
        showStatusMessage('Please select a JSON file', 'error');
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        const result = await window.electronAPI.importTranslationHistory(data, true); // merge = true

        if (result.success) {
          await loadHistoryData(); // 履歴を再読み込み
          showStatusMessage(
            `${result.importedCount} translation${result.importedCount !== 1 ? 's' : ''} imported`,
            'success',
          );
        } else {
          throw new Error(result.error || 'Import failed');
        }
      } catch (parseError) {
        console.error('Failed to parse import file:', parseError);
        showStatusMessage('Invalid file format', 'error');
      }

      fileInput.value = ''; // ファイル選択をリセット
    };
  } catch (error) {
    console.error('Import failed:', error);
    showStatusMessage('Import failed', 'error');
  }
}

/**
 * 履歴クリア処理
 */
async function handleClearHistory(keepDays = null) {
  const isAll = keepDays === null;
  const title = isAll ? 'Clear All History' : 'Clear Old History';
  const message = isAll
    ? 'Are you sure you want to delete all translation history? This action cannot be undone.'
    : `Are you sure you want to delete translations older than ${keepDays} days? This action cannot be undone.`;

  const confirmed = await showConfirmationDialog(title, message, 'Clear');
  if (!confirmed) {
    return;
  }

  try {
    const result = await window.electronAPI.clearTranslationHistory({
      keepFavorites: true, // お気に入りは保持
      keepDays: keepDays,
    });

    if (result.success) {
      await loadHistoryData(); // 履歴を再読み込み
      showStatusMessage(isAll ? 'All history cleared' : 'Old history cleared', 'success');
    } else {
      throw new Error(result.error || 'Failed to clear history');
    }
  } catch (error) {
    console.error('Failed to clear history:', error);
    showStatusMessage('Failed to clear history', 'error');
  }
}

/**
 * 最大履歴件数更新処理
 */
async function handleUpdateMaxHistory() {
  const input = document.getElementById('max-history');
  const maxItems = parseInt(input.value, 10);

  if (isNaN(maxItems) || maxItems < 10 || maxItems > 1000) {
    showStatusMessage('Max items must be between 10 and 1000', 'error');
    return;
  }

  try {
    const result = await window.electronAPI.updateMaxTranslationHistory(maxItems);

    if (result.success) {
      showStatusMessage(`Max history items set to ${maxItems}`, 'success');

      // 現在の件数が新しい上限を超えている場合は再読み込み
      if (state.currentHistory.length > maxItems) {
        await loadHistoryData();
      }
    } else {
      throw new Error(result.error || 'Failed to update max items');
    }
  } catch (error) {
    console.error('Failed to update max history:', error);
    showStatusMessage('Failed to update settings', 'error');
  }
}

// === INITIALIZATION ===

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 検索関連
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearSearchBtn = document.getElementById('clear-search');

  searchInput.addEventListener('input', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
  searchBtn.addEventListener('click', handleSearch);
  clearSearchBtn.addEventListener('click', handleClearSearch);

  // フィルター関連
  document.getElementById('language-filter').addEventListener('change', (e) => {
    state.filters.language = e.target.value;
    applyFilters();
  });

  document.getElementById('date-filter').addEventListener('change', (e) => {
    state.filters.date = e.target.value;
    applyFilters();
  });

  document.getElementById('type-filter').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    applyFilters();
  });

  // ビュー切り替え
  document.getElementById('view-list').addEventListener('click', () => {
    state.viewMode = 'list';
    document.getElementById('view-list').classList.add('active');
    document.getElementById('view-grid').classList.remove('active');
    // Note: Grid view implementation would go here
  });

  document.getElementById('view-grid').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('view-grid').classList.add('active');
    document.getElementById('view-list').classList.remove('active');
    // Note: Grid view implementation would go here
  });

  // 選択関連
  document.getElementById('select-all').addEventListener('change', (e) => {
    handleSelectAll(e.target.checked);
  });

  document.getElementById('delete-selected').addEventListener('click', handleDeleteSelected);
  document.getElementById('export-selected').addEventListener('click', () => handleExport(true));

  // ページネーション
  document.getElementById('prev-page').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      updateHistoryDisplay();
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredHistory.length / state.itemsPerPage);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      updateHistoryDisplay();
    }
  });

  // アクションボタン
  document.getElementById('clear-filters').addEventListener('click', handleClearFilters);
  document.getElementById('start-translating').addEventListener('click', () => {
    window.electronAPI.closeHistoryWindow();
  });

  // 管理機能
  document.getElementById('update-limit').addEventListener('click', handleUpdateMaxHistory);
  document.getElementById('clear-old').addEventListener('click', () => handleClearHistory(30));
  document.getElementById('clear-all').addEventListener('click', () => handleClearHistory(null));
  document.getElementById('import-history').addEventListener('click', handleImport);
  document.getElementById('export-history').addEventListener('click', () => handleExport(false));

  // フッター
  document.getElementById('close-history').addEventListener('click', () => {
    window.electronAPI.closeHistoryWindow();
  });

  document.getElementById('open-settings').addEventListener('click', () => {
    window.electronAPI.openSettings();
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.electronAPI.closeHistoryWindow();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/**
 * 初期設定を読み込み
 */
async function loadInitialSettings() {
  try {
    const result = await window.electronAPI.getTranslationHistorySettings();

    if (result.success) {
      const maxHistoryInput = document.getElementById('max-history');
      maxHistoryInput.value = result.settings.maxItems || 100;
    }
  } catch (error) {
    console.error('Failed to load history settings:', error);
  }
}

/**
 * アプリケーション初期化
 */
async function initializeApp() {
  try {
    setupEventListeners();
    await loadInitialSettings();
    await loadHistoryData();

    console.log('Translation history app initialized successfully');
  } catch (error) {
    console.error('Failed to initialize translation history app:', error);
    showStatusMessage('Failed to initialize app', 'error');
  }
}

// === APP START ===

// DOM読み込み完了時にアプリを初期化
document.addEventListener('DOMContentLoaded', initializeApp);
