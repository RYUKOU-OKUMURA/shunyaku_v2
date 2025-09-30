# Development Guidelines for Shunyaku v2 (Hover Translation App)

This document provides project-specific development information for the Shunyaku v2 Electron-based macOS translation application.

---

## 1. Project Overview

**Type**: Electron application (macOS-only)  
**Purpose**: Screenshot → OCR → Translation → HUD display workflow  
**Tech Stack**: Electron, Node.js, Jest (testing)  
**Target Platform**: macOS (M1/M2 Apple Silicon primarily)

---

## 2. Build & Configuration

### Prerequisites
- **Node.js**: v16+ recommended (v18+ for optimal Electron compatibility)
- **npm**: v8+ (comes with Node.js)
- **macOS**: Required for Screen Recording API and platform-specific features
- **Xcode Command Line Tools**: Required for native module compilation

### Initial Setup
```bash
# Install dependencies
npm install

# Verify installation
npm test
```

### Project Structure
```
shunyaku_v2/
├── src/                    # Source code
│   ├── *.js               # Main application code
│   └── *.test.js          # Test files (co-located with source)
├── jest.config.js         # Jest testing configuration
├── package.json           # Project dependencies and scripts
└── .junie/                # Development guidelines
```

### Key Dependencies
- **electron**: Main framework for desktop application
- **jest**: Testing framework
- **@types/jest**: TypeScript definitions for Jest (helpful for IDE support)

### Future Dependencies (per requirements document)
- **tesseract.js**: OCR engine for text extraction
- **deepl-node**: DeepL API wrapper for translation
- **electron-store**: Persistent settings storage
- **keytar**: Secure API key storage in macOS Keychain
- **electron-builder**: For packaging and distribution

---

## 3. Testing

### Testing Framework
This project uses **Jest** for unit and integration testing.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Configuration
- **Config File**: `jest.config.js`
- **Test Environment**: Node.js
- **Test File Pattern**: `*.test.js` or `*.spec.js`
- **Coverage Directory**: `coverage/`

### Writing Tests

Tests should be co-located with source files:
```
src/
├── translationHelper.js
└── translationHelper.test.js
```

**Example Test Structure**:
```javascript
const { functionName } = require('./moduleName');

describe('Module Name', () => {
  describe('functionName', () => {
    test('should do something specific', () => {
      expect(functionName(input)).toBe(expectedOutput);
    });

    test('should handle edge cases', () => {
      expect(functionName(null)).toBe(expectedValue);
    });
  });
});
```

### Test Example (Verified Working)

**Source**: `src/translationHelper.js`
```javascript
function cleanOCRText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.trim().replace(/\s+/g, ' ');
}
```

**Test**: `src/translationHelper.test.js`
```javascript
describe('cleanOCRText', () => {
  test('should remove extra whitespace', () => {
    expect(cleanOCRText('  Hello   World  ')).toBe('Hello World');
  });

  test('should handle empty or invalid input', () => {
    expect(cleanOCRText('')).toBe('');
    expect(cleanOCRText(null)).toBe('');
  });
});
```

**Running the test**:
```bash
npm test
# Output: ✓ should remove extra whitespace
#         ✓ should handle empty or invalid input
```

### Testing Best Practices
1. **Test Organization**: Use `describe` blocks to group related tests
2. **Test Naming**: Use descriptive names starting with "should"
3. **Edge Cases**: Always test null, undefined, empty strings, and invalid inputs
4. **Isolation**: Each test should be independent and not rely on others
5. **Coverage Target**: Aim for >80% code coverage for critical modules

---

## 4. Code Style & Development Guidelines

### JavaScript Standards
- **Module System**: CommonJS (`require`/`module.exports`) for Node.js compatibility
- **Async Operations**: Use async/await for asynchronous code (avoid callback hell)
- **Error Handling**: Always wrap async operations in try-catch blocks

### Code Organization Principles
1. **Separation of Concerns**: Keep UI (Renderer), business logic (Main), and utilities separate
2. **Single Responsibility**: Each module/function should do one thing well
3. **Co-located Tests**: Keep test files next to source files for easy discovery

### Documentation Standards
- **JSDoc Comments**: Required for all exported functions
- **Format**:
  ```javascript
  /**
   * Brief description of function
   * @param {type} paramName - Parameter description
   * @returns {type} - Return value description
   */
  ```
- **Example** (from translationHelper.js):
  ```javascript
  /**
   * Validates if a language code is supported
   * @param {string} langCode - Language code (e.g., 'EN', 'JA')
   * @returns {boolean} - True if supported
   */
  function isSupportedLanguage(langCode) {
    // implementation
  }
  ```

### Naming Conventions
- **Files**: camelCase (e.g., `translationHelper.js`, `hudWindowManager.js`)
- **Functions**: camelCase (e.g., `cleanOCRText`, `isSupportedLanguage`)
- **Classes**: PascalCase (e.g., `CaptureService`, `TranslationService`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)

### Error Handling Pattern
```javascript
async function someAsyncOperation() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (error) {
    console.error('Error in someAsyncOperation:', error);
    // Handle or rethrow as appropriate
    throw new Error(`Failed to complete operation: ${error.message}`);
  } finally {
    // Cleanup (e.g., delete temporary files)
  }
}
```

---

## 5. macOS-Specific Considerations

### Screen Recording Permission
- **Required**: macOS Screen Recording permission must be granted
- **Implementation**: Check permissions on app startup
- **User Guidance**: Display system preferences dialog if permission denied
- **Testing**: Always test permission flow in fresh macOS environment

### Native Modules
- Some dependencies (like native OCR libraries) may require compilation
- **Electron Rebuild**: May be needed after installing native modules:
  ```bash
  npm install --save-dev electron-rebuild
  npx electron-rebuild
  ```

### Keychain Access
- API keys should be stored in macOS Keychain (via `keytar` module)
- Never store sensitive credentials in plain text or config files
- Test keychain access with proper entitlements

---

## 6. Development Workflow

### Phase-Based Development
The project follows a phased approach (see requirements document):
- **Phase 0**: Environment setup ✓
- **Phase 1**: Static HUD window
- **Phase 2**: Translation pipeline (without OCR)
- **Phase 3**: Full OCR + Translation (MVP)
- **Phase 4**: UX improvements
- **Phase 5**: Distribution & signing

### Adding New Features
1. Create feature branch (if using git)
2. Implement feature with co-located tests
3. Run full test suite: `npm test`
4. Verify manually on macOS
5. Update documentation if needed

### Debugging
- **Main Process Logs**: Use `console.log` or electron-log
- **Renderer Process**: Use Chrome DevTools (accessible via Electron)
- **Test Debugging**: Use `test.only()` to run single test
  ```javascript
  test.only('should debug this specific test', () => {
    // test code
  });
  ```

---

## 7. Performance Guidelines

### Target Metrics (from requirements)
- **Processing Time**: < 6 seconds for screenshot → OCR → translation → display
- **Success Rate**: > 95% for standard use cases
- **Memory**: Keep HUD window lightweight (< 50MB resident memory)

### Optimization Strategies
1. **Worker Threads**: Use for OCR processing to avoid blocking main thread
2. **Image Preprocessing**: Downscale large screenshots before OCR
3. **API Caching**: Cache translation results for repeated text
4. **Lazy Loading**: Load heavy dependencies only when needed

---

## 8. Security & Privacy

### Data Handling
- **Temporary Files**: Store in `~/Library/Caches/HoverTranslate/`
- **Cleanup**: Always delete temp files after processing (use `finally` blocks)
- **API Keys**: Store in Keychain, never in code or config files
- **Logging**: Never log sensitive data (API keys, user text content)

### HTTPS Requirements
- All API calls (DeepL, etc.) must use HTTPS
- Verify SSL certificates in production

---

## 9. Common Issues & Solutions

### Issue: Tests fail after adding native modules
**Solution**: Run `npx electron-rebuild` to recompile native modules for Electron

### Issue: Screen Recording permission not detected
**Solution**: Use Electron's `systemPreferences.getMediaAccessStatus('screen')` API

### Issue: HUD window not appearing on top
**Solution**: Set `alwaysOnTop: true` and `level: 'floating'` in BrowserWindow options

### Issue: Jest tests timing out
**Solution**: Increase timeout for async tests:
```javascript
test('async operation', async () => {
  // test code
}, 10000); // 10 second timeout
```

---

## 10. Resources

### Key Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [DeepL API Documentation](https://www.deepl.com/docs-api)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)

### Requirements Document
- See: `ローカル"ホバー翻訳"アプリ：要件定義.md` for full project requirements

---

## 11. Quick Reference Commands

```bash
# Install dependencies
npm install

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Future commands (when implemented)
npm start              # Start Electron app in dev mode
npm run build          # Build distributable .app
npm run lint           # Run code linter
npm run format         # Format code with Prettier
```

---

**Last Updated**: 2025-09-30  
**For**: Advanced developers working on Shunyaku v2 Electron application
