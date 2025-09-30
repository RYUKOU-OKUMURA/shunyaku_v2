/**
 * Shunyaku v2 - Renderer Process Script
 */

document.addEventListener('DOMContentLoaded', () => {
    // Test the electronAPI bridge
    if (window.electronAPI) {
        const testResult = window.electronAPI.test();
        console.log('ElectronAPI test:', testResult);
    }

    // Display Node.js version
    const nodeVersionElement = document.getElementById('node-version');
    if (nodeVersionElement) {
        nodeVersionElement.textContent = process.versions.node;
    }

    console.log('Shunyaku v2 renderer process initialized');
});