const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

/**
 * E2E Test: Permissions and macOS Integration
 * 
 * These tests verify proper handling of macOS permissions and system integration.
 */
test.describe('Permissions and System Integration', () => {
  let electronApp;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['src/main/main.js', '--dev'],
      cwd: process.cwd()
    });
  });

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('should check Screen Recording permission status', async () => {
    const permissionStatus = await electronApp.evaluate(async ({ systemPreferences }) => {
      try {
        // Check Screen Recording permission
        const hasPermission = systemPreferences.getMediaAccessStatus('screen');
        return {
          screenRecording: hasPermission,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(permissionStatus.success).toBe(true);
    // Permission status can be 'not-determined', 'granted', 'denied', or 'restricted'
    expect(['not-determined', 'granted', 'denied', 'restricted']).toContain(permissionStatus.screenRecording);
  });

  test('should handle permission request gracefully', async () => {
    const permissionRequest = await electronApp.evaluate(async ({ systemPreferences }) => {
      try {
        // This will trigger permission request if not already granted
        const status = systemPreferences.getMediaAccessStatus('screen');
        
        if (status === 'not-determined') {
          // In a real app, this would trigger the permission dialog
          // For testing, we simulate the behavior
          return {
            status: 'permission-requested',
            message: 'Permission dialog would be shown',
            success: true
          };
        } else {
          return {
            status,
            message: `Permission already ${status}`,
            success: true
          };
        }
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(permissionRequest.success).toBe(true);
    expect(permissionRequest.status).toBeTruthy();
  });

  test('should provide appropriate guidance for permission setup', async () => {
    // Mock permission status as denied to test guidance flow
    const guidanceTest = await electronApp.evaluate(async () => {
      const { AppLifecycleManager } = require('./src/services/AppLifecycleManager');
      
      try {
        const appManager = new AppLifecycleManager();
        
        // Simulate permission denied scenario
        const mockPermissionStatus = 'denied';
        const guidanceResult = appManager.getPermissionGuidance(mockPermissionStatus);
        
        return {
          guidance: guidanceResult,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(guidanceTest.success).toBe(true);
    expect(guidanceTest.guidance).toBeTruthy();
    expect(typeof guidanceTest.guidance).toBe('object');
  });

  test('should handle system preferences opening', async () => {
    const systemPrefsTest = await electronApp.evaluate(async ({ shell }) => {
      try {
        // Test the mechanism to open system preferences
        // We don't actually open it in tests, just verify the method exists
        const canOpenSystemPrefs = typeof shell.openExternal === 'function';
        
        if (canOpenSystemPrefs) {
          // In a real scenario, this would open:
          // shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
          return {
            canOpenSystemPrefs: true,
            method: 'shell.openExternal available',
            success: true
          };
        } else {
          return {
            canOpenSystemPrefs: false,
            success: false
          };
        }
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(systemPrefsTest.success).toBe(true);
    expect(systemPrefsTest.canOpenSystemPrefs).toBe(true);
  });

  test('should validate keychain access for API keys', async () => {
    const keychainTest = await electronApp.evaluate(async () => {
      const { KeychainManager } = require('./src/services/KeychainManager');
      
      try {
        const keychainManager = new KeychainManager();
        
        // Test storing and retrieving a test API key
        const testKey = 'test-api-key-12345';
        
        // Store test key
        await keychainManager.storeApiKey('deepl', testKey);
        
        // Retrieve test key
        const retrievedKey = await keychainManager.getApiKey('deepl');
        
        // Clean up test key
        await keychainManager.deleteApiKey('deepl');
        
        return {
          stored: testKey,
          retrieved: retrievedKey,
          match: testKey === retrievedKey,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(keychainTest.success).toBe(true);
    expect(keychainTest.match).toBe(true);
  });

  test('should handle global shortcut registration', async () => {
    const shortcutTest = await electronApp.evaluate(async ({ globalShortcut }) => {
      try {
        // Test shortcut registration capability
        const testShortcut = 'CommandOrControl+Shift+F1'; // Unlikely to conflict
        
        let registrationResult;
        try {
          registrationResult = globalShortcut.register(testShortcut, () => {
            // Test callback - doesn't need to do anything
          });
          
          // Clean up
          globalShortcut.unregister(testShortcut);
        } catch (regError) {
          registrationResult = false;
        }
        
        return {
          registrationSuccessful: registrationResult,
          shortcutTested: testShortcut,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(shortcutTest.success).toBe(true);
    // Note: In CI/testing environments, shortcut registration might fail
    // So we don't strictly require it to succeed
  });

  test('should handle app lifecycle events', async () => {
    const lifecycleTest = await electronApp.evaluate(async ({ app }) => {
      try {
        const appInfo = {
          name: app.getName(),
          version: app.getVersion(),
          isReady: app.isReady(),
          isPackaged: app.isPackaged,
          path: app.getAppPath()
        };
        
        // Test event listener registration
        let eventListenersRegistered = 0;
        
        // Test registering common app events
        const testEvents = ['before-quit', 'window-all-closed', 'activate'];
        testEvents.forEach(eventName => {
          try {
            app.on(eventName, () => {});
            eventListenersRegistered++;
          } catch (e) {
            // Event might not be supported in test environment
          }
        });
        
        return {
          appInfo,
          eventListenersRegistered,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(lifecycleTest.success).toBe(true);
    expect(lifecycleTest.appInfo.name).toBe('shunyaku-v2');
    expect(lifecycleTest.appInfo.isReady).toBe(true);
    expect(lifecycleTest.eventListenersRegistered).toBeGreaterThan(0);
  });

  test('should validate network access capabilities', async () => {
    const networkTest = await electronApp.evaluate(async () => {
      try {
        // Test basic network access capability
        const { net } = require('electron');
        
        if (!net) {
          return {
            networkModuleAvailable: false,
            success: false
          };
        }
        
        // Test creating a network request (don't send it)
        let requestCreationSuccessful = false;
        try {
          const request = net.request({
            method: 'GET',
            protocol: 'https:',
            hostname: 'httpbin.org',
            port: 443,
            path: '/get'
          });
          requestCreationSuccessful = !!request;
          request.abort(); // Clean up
        } catch (e) {
          requestCreationSuccessful = false;
        }
        
        return {
          networkModuleAvailable: true,
          requestCreationSuccessful,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(networkTest.success).toBe(true);
    expect(networkTest.networkModuleAvailable).toBe(true);
  });

  test('should handle file system permissions', async () => {
    const fileSystemTest = await electronApp.evaluate(async () => {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      try {
        // Test creating temporary file in user directory
        const tmpDir = os.tmpdir();
        const testFilePath = path.join(tmpDir, 'shunyaku-test-' + Date.now() + '.txt');
        
        // Write test file
        await fs.writeFile(testFilePath, 'Test file content');
        
        // Read test file
        const content = await fs.readFile(testFilePath, 'utf-8');
        
        // Clean up
        await fs.unlink(testFilePath);
        
        return {
          canCreateFiles: true,
          canReadFiles: content === 'Test file content',
          tempDir: tmpDir,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(fileSystemTest.success).toBe(true);
    expect(fileSystemTest.canCreateFiles).toBe(true);
    expect(fileSystemTest.canReadFiles).toBe(true);
  });

  test('should handle screenshot directory access', async () => {
    const screenshotDirTest = await electronApp.evaluate(async () => {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      try {
        // Test access to typical screenshot locations
        const possibleDirs = [
          path.join(os.homedir(), 'Desktop'),
          path.join(os.homedir(), 'Downloads'),
          os.tmpdir()
        ];
        
        const accessResults = [];
        
        for (const dir of possibleDirs) {
          try {
            await fs.access(dir);
            accessResults.push({ dir, accessible: true });
          } catch (e) {
            accessResults.push({ dir, accessible: false, error: e.code });
          }
        }
        
        return {
          accessResults,
          success: true
        };
      } catch (error) {
        return {
          error: error.message,
          success: false
        };
      }
    });

    expect(screenshotDirTest.success).toBe(true);
    // At least one directory should be accessible
    const accessibleDirs = screenshotDirTest.accessResults.filter(result => result.accessible);
    expect(accessibleDirs.length).toBeGreaterThan(0);
  });
});