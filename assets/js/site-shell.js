import { initTheme, setupThemePicker } from './theme.js';
import { setupNavHighlight, setupNavMobile } from './nav.js';

export function initPageShell({ enableThemePicker = false } = {}) {
  initTheme();
  setupNavHighlight();
  setupNavMobile();

  if (enableThemePicker) {
    setupThemePicker();
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('../../sw.js', import.meta.url);
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn('[Service Worker] Registration failed:', error);
    });
  });
}
