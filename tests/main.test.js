/**
 * Basic tests for main process
 */

describe('Main Process Tests', () => {
  test('should pass basic test', () => {
    expect(true).toBe(true);
  });

  test('package.json should exist and be valid', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('shunyaku-v2');
    expect(pkg.main).toBe('src/main/main.js');
    expect(pkg.scripts.test).toBe('jest');
  });

  test('Node.js version should be 18+', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    expect(majorVersion).toBeGreaterThanOrEqual(18);
  });
});