/* ==========================================================================
   Leyes-Plus Argentina — Shared module: ui-shell
   Helpers de UI compartidos: splitter resizer, dropdowns, theme apply,
   icon set inline, toggle button, toast.
   ========================================================================== */

(function () {
  'use strict';

  const NS = (window.ILP = window.ILP || {});

  NS.icons = {
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    book:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
    fileText:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
    md:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15V9l2 2 2-2v6"/><path d="M17 9v6m0-3-2 3 2 3"/></svg>',
    print:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/></svg>',
    textPlus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    textMinus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
    fontFamily:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 9 4l5 16"/><path d="M6 14h6"/><path d="M16 14h4l-2-6"/></svg>',
    list:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13M3 12h13M3 18h13"/><circle cx="20" cy="6" r="1"/><circle cx="20" cy="12" r="1"/><circle cx="20" cy="18" r="1"/></svg>',
    arrowUp:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
    arrowLeft:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    arrowRight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    chevronRight:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    scale:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 8h18"/><path d="M5 8a4 4 0 0 1-2 6"/><path d="M19 8a4 4 0 0 0 2 6"/></svg>',
    layers:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    externalLink:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  function applyTheme(root, theme) {
    if (!root) return;
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('.ilp-theme-dot').forEach((d) => {
      d.classList.toggle('active', d.dataset.theme === theme);
    });
  }

  function applyFont(root, family, size) {
    if (!root) return;
    root.setAttribute('data-font', family);
    const body = root.querySelector('#ilp-reader-body-content') || root;
    body.style.setProperty('--ilp-reader-font-size', size + '%');
  }

  /**
   * Crea un splitter horizontal que permite redimensionar el ancho de `target`.
   * `sideRight` = true si el target está a la derecha (entonces el ancho
   * disminuye cuando el cursor va a la derecha).
   */
  function makeResizable(handle, target, opts) {
    const cfg = Object.assign({ min: 200, max: 700, storageKey: null, sideRight: false }, opts || {});
    if (!handle || !target) return;
    let startX, startWidth;
    function onDown(e) {
      e.preventDefault();
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(target).width, 10);
      handle.classList.add('ilp-splitter-active');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    function onMove(e) {
      const delta = e.clientX - startX;
      let w = cfg.sideRight ? startWidth - delta : startWidth + delta;
      if (w < cfg.min) w = cfg.min;
      if (w > cfg.max) w = cfg.max;
      target.style.width = w + 'px';
      target.style.flexBasis = w + 'px';
    }
    function onUp() {
      handle.classList.remove('ilp-splitter-active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (cfg.storageKey && !target.classList.contains('collapsed')) {
        try { localStorage.setItem('ilp-' + cfg.storageKey, target.style.width); } catch (_) {}
      }
    }
    handle.addEventListener('mousedown', onDown);
  }

  function applySavedWidth(target, storageKey, fallback) {
    if (!target) return;
    try {
      const v = localStorage.getItem('ilp-' + storageKey);
      if (v && !target.classList.contains('collapsed')) {
        target.style.width = v;
        target.style.flexBasis = v;
      } else if (fallback) {
        target.style.width = fallback + 'px';
        target.style.flexBasis = fallback + 'px';
      }
    } catch (_) {}
  }

  function toast(message, kind) {
    let host = document.getElementById('ilp-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ilp-toast-host';
      host.style.cssText = 'position:fixed;bottom:88px;right:24px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = `
      background: var(--ilp-bg-2, #fff);
      color: var(--ilp-text-0, #1c1917);
      border: 1px solid var(--ilp-border, rgba(0,0,0,.1));
      border-radius: 10px;
      padding: 10px 14px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0,0,0,.15);
      pointer-events: auto;
      opacity: 0;
      transform: translateY(8px);
      transition: all 200ms ease;
    `;
    if (kind === 'error') el.style.borderColor = 'var(--ilp-accent, #5850ec)';
    host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 220);
    }, 2400);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('execCommand falló'));
      } catch (err) {
        reject(err);
      } finally {
        ta.remove();
      }
    });
  }

  NS.ui = {
    applyTheme,
    applyFont,
    makeResizable,
    applySavedWidth,
    toast,
    copyToClipboard
  };
})();
