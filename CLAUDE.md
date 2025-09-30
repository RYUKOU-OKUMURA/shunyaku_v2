# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shunyaku v2** is a local hover translation app for macOS built with Electron. The app performs OCR on screenshots and translates them using the DeepL API, displaying results in a floating HUD window.

**Technology Stack:**
- Framework: Electron v27
- Language: JavaScript (Node.js v18+)
- Testing: Jest
- OCR: tesseract.js
- Translation: deepl-node (DeepL API)
- Settings: electron-store, keytar (macOS Keychain)

## Development Commands

```bash
# Install dependencies
npm install

# Start the app
npm start

# Start in development mode (with DevTools)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting without changes
npm run format:check

# Pre-commit hook (runs automatically)
npm run precommit
```

## Architecture

### Process Model

**Main Process** ([src/main/main.js](src/main/main.js)):
- App lifecycle management
- IPC communication handlers
- Window management coordination
- macOS-specific behavior (Dock, Screen Recording permissions)

**Renderer Process** ([src/renderer/](src/renderer/)):
- HUD UI ([hud.html](src/renderer/hud.html), [hud.js](src/renderer/hud.js), [hud.css](src/renderer/hud.css))
- Main window ([index.html](src/renderer/index.html), [renderer.js](src/renderer/renderer.js))
- Preload script ([preload.js](src/renderer/preload.js)) for secure IPC communication

### Core Components

**HUDWindowManager** ([src/main/HUDWindowManager.js](src/main/HUDWindowManager.js)):
- Creates and manages frameless, transparent HUD windows
- Controls positioning (including near-mouse placement)
- Handles window lifecycle (show/hide/close/destroy)
- Configuration: `alwaysOnTop: true`, `level: 'floating'`, `transparent: true`

**SettingsStore** ([src/services/SettingsStore.js](src/services/SettingsStore.js)):
- Persistent settings management using electron-store
- Schema-validated settings with defaults
- Settings categories: translation, OCR, HUD, shortcuts, app
- Change listeners with key-specific watching
- Export/import functionality

### IPC Communication

Main process handlers registered in `setupIPCHandlers()`:
- `close-hud`: Close the HUD window
- `hide-hud`: Hide the HUD window
- `show-hud`: Show HUD with options
- `show-hud-near-mouse`: Show HUD near cursor position
- `get-cursor-position`: Get current cursor screen point

### Settings Schema

Settings are organized into five main categories (see [SettingsStore.js:16-177](src/services/SettingsStore.js#L16-L177)):

1. **translation**: Target/source languages (default: auto → ja)
2. **ocr**: Languages, PSM mode, confidence threshold
3. **hud**: Size, auto-hide duration (15s default), theme, opacity
4. **shortcuts**: Keyboard shortcuts (default: Cmd+Shift+T for translate)
5. **app**: Start behavior, auto-update, analytics, log level

## Development Workflow

### Task-Based Development

This project follows a strict task-based workflow defined in [AGENT.md](AGENT.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md):

1. Tasks are organized into phases (Phase 0-5)
2. Each task has checkboxes that must be updated upon completion
3. Implementation reports must be created for completed tasks
4. Git commits must include task numbers: `[X.Y.Z] Task description`
5. **Always ask user for permission before committing and pushing to Git**

### Current Status

The project has completed:
- Phase 0: Environment setup (tasks 0.1-0.3) ✅
- Phase 1: Static HUD window (tasks 1.1-1.3) ✅
- Task 2.1: Settings management system ✅

Next up: Task 2.2 (Keychain API key management)

### Code Quality

**Linting & Formatting:**
- ESLint configured with automatic fixes
- Prettier for consistent formatting
- Husky pre-commit hooks enforce quality
- Run `npm run lint:fix && npm run format` before committing

**Testing:**
- Jest for unit tests (see [tests/](tests/) directory)
- Test files: `*.test.js`
- Setup file: [tests/setup.js](tests/setup.js)
- Existing tests: SettingsStore, HUD, main process

## macOS-Specific Considerations

### Permissions
- **Screen Recording permission** required for screenshot capture (Phase 3)
- Permission checks handled by future AppLifecycleManager component
- Guide users through System Preferences when permission is missing

### Dock Behavior
- Currently shows in Dock (`app.dock.show()`)
- May be hidden in later phases for background operation

### Window Levels
- HUD uses `level: 'floating'` to stay above all windows
- Combined with `alwaysOnTop: true` for maximum visibility

## Planned Components (Not Yet Implemented)

The following components are planned but not yet implemented:

- **CaptureService**: Screenshot capture using desktopCapturer
- **OCRService**: Text extraction from images using tesseract.js
- **TranslationService**: DeepL API integration with retry logic
- **KeychainManager**: Secure API key storage in macOS Keychain
- **AppLifecycleManager**: Startup, permissions, crash handling

Refer to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed task breakdown.

## File Structure

```
src/
├── main/              # Main process code
│   ├── main.js        # Entry point, app lifecycle
│   └── HUDWindowManager.js  # HUD window management
├── renderer/          # Renderer process code
│   ├── hud.html/js/css      # HUD interface
│   ├── index.html           # Main window
│   ├── preload.js           # IPC bridge
│   └── renderer.js          # Main window logic
└── services/          # Shared services
    └── SettingsStore.js     # Settings management

tests/                 # Jest tests
docs/                  # Documentation
├── apple-developer-setup.md
├── certificate-management.md
└── signing.md
```

## Important Notes

1. **Always follow the task workflow** defined in [AGENT.md](AGENT.md)
2. **Update checkboxes** in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) when completing tasks
3. **Create implementation reports** after each task completion
4. **Ask user before git operations** - Never commit/push without permission
5. **Validate security**: API keys in Keychain, no secrets in logs, temp files cleaned up
6. **Test thoroughly**: Unit tests + manual verification for each task
7. **macOS only**: This is a macOS-exclusive application

## References

- [AGENT.md](AGENT.md): Detailed agent execution guide and workflow
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): Complete task breakdown with checkboxes
- Requirements (Japanese): [ローカル"ホバー翻訳"アプリ：要件定義.md](ローカル"ホバー翻訳"アプリ：要件定義.md)
- Implementation reports: `TASK_*_IMPLEMENTATION_REPORT.md` files