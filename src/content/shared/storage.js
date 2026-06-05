/* ==========================================================================
   Leyes-Plus Argentina — Shared module: storage
   Wrapper sobre chrome.storage.local con namespace `ilp-`.
   ========================================================================== */

(function () {
  'use strict';

  const NS = (window.ILP = window.ILP || {});

  const PREFIX = 'ilp-';

  const DEFAULTS = {
    settings: {
      theme: 'light',
      fontSize: 100,
      fontFamily: 'serif',
      accent: 'indigo',
      defaultTab: 'simple'
    },
    history: [],
    favorites: []
  };

  function key(name) {
    return PREFIX + name;
  }

  function getChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
  }

  function localGet(name) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function localSet(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch (_) {
      /* quota / unavailable */
    }
  }

  NS.storage = {
    async get(name) {
      const cs = getChromeStorage();
      if (cs) {
        return new Promise((resolve) => {
          cs.get([key(name)], (data) => {
            if (chrome.runtime.lastError) {
              resolve(localGet(name) ?? structuredClone(DEFAULTS[name] ?? null));
            } else {
              resolve(data[key(name)] ?? structuredClone(DEFAULTS[name] ?? null));
            }
          });
        });
      }
      return localGet(name) ?? structuredClone(DEFAULTS[name] ?? null);
    },

    async set(name, value) {
      const cs = getChromeStorage();
      if (cs) {
        return new Promise((resolve) => {
          cs.set({ [key(name)]: value }, () => {
            localSet(name, value); // mirror
            resolve();
          });
        });
      }
      localSet(name, value);
    },

    async getAll() {
      const names = Object.keys(DEFAULTS);
      const cs = getChromeStorage();
      if (cs) {
        const allKeys = names.map(key);
        return new Promise((resolve) => {
          cs.get(allKeys, (data) => {
            const out = {};
            for (const name of names) {
              if (chrome.runtime.lastError) {
                out[name] = structuredClone(DEFAULTS[name] ?? null);
              } else {
                out[name] = data[key(name)] ?? structuredClone(DEFAULTS[name] ?? null);
              }
            }
            resolve(out);
          });
        });
      }
      const out = {};
      for (const name of names) {
        out[name] = localGet(name) ?? structuredClone(DEFAULTS[name] ?? null);
      }
      return out;
    },

    defaults: DEFAULTS
  };
})();
