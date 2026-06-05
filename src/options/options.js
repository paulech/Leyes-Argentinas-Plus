/* Leyes-Plus Argentina — options page */
(function () {
  'use strict';

  const DEFAULTS = {
    theme: 'light',
    fontSize: 100,
    fontFamily: 'serif',
    defaultTab: 'simple',
    enableCordoba: true
  };

  function getChrome() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  async function load() {
    const cs = getChrome();
    if (!cs) return DEFAULTS;
    return new Promise((resolve) => {
      cs.get(['ilp-settings'], (data) => {
        resolve(Object.assign({}, DEFAULTS, data['ilp-settings'] || {}));
      });
    });
  }

  async function save(patch) {
    const cur = await load();
    const next = Object.assign({}, cur, patch);
    const cs = getChrome();
    if (cs) {
      return new Promise((resolve) => cs.set({ 'ilp-settings': next }, () => resolve(next)));
    }
    return next;
  }

  async function clearKey(key) {
    const cs = getChrome();
    if (cs) {
      return new Promise((resolve) => cs.remove(['ilp-' + key], resolve));
    }
  }

  async function wipe() {
    const cs = getChrome();
    if (cs) {
      return new Promise((resolve) => cs.clear(resolve));
    }
  }

  async function init() {
    const settings = await load();
    document.body.setAttribute('data-theme', settings.theme);

    // Themes
    const themesEl = document.getElementById('ilp-opt-themes');
    themesEl.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === settings.theme);
      b.addEventListener('click', async () => {
        themesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        document.body.setAttribute('data-theme', b.dataset.theme);
        await save({ theme: b.dataset.theme });
      });
    });

    // Font family
    const fontEl = document.getElementById('ilp-opt-font');
    fontEl.value = settings.fontFamily;
    fontEl.addEventListener('change', () => save({ fontFamily: fontEl.value }));

    // Font size
    const sizeEl = document.getElementById('ilp-opt-size');
    sizeEl.value = settings.fontSize;
    sizeEl.addEventListener('change', () => {
      const v = Math.max(70, Math.min(160, parseInt(sizeEl.value, 10) || 100));
      sizeEl.value = v;
      save({ fontSize: v });
    });

    // Córdoba module toggle
    const cordobaEl = document.getElementById('ilp-opt-cordoba');
    cordobaEl.checked = !!settings.enableCordoba;
    cordobaEl.addEventListener('change', () => save({ enableCordoba: cordobaEl.checked }));

    // Clear buttons
    document.getElementById('ilp-opt-clear-history').addEventListener('click', async () => {
      await clearKey('history');
      alert('Historial borrado.');
    });
    document.getElementById('ilp-opt-wipe').addEventListener('click', async () => {
      if (confirm('¿Borrar todos los datos locales (historial, favoritos, caché, ajustes)?')) {
        await wipe();
        location.reload();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
