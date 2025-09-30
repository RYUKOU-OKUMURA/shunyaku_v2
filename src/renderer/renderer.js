/**
 * Shunyaku v2 - Renderer Process Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Test the electronAPI bridge
  if (window.electronAPI) {
    const testResult = window.electronAPI.test();
    // eslint-disable-next-line no-console
    console.log('ElectronAPI test:', testResult);
  }

  // Display Node.js version
  const nodeVersionElement = document.getElementById('node-version');
  if (nodeVersionElement) {
    nodeVersionElement.textContent = process.versions.node;
  }

  // eslint-disable-next-line no-console
  console.log('Shunyaku v2 renderer process initialized');
});
