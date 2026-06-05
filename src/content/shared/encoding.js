/* ==========================================================================
   Leyes-Plus Argentina — Shared module: encoding
   Detección y decoding de windows-1252 vs utf-8 para páginas de Infoleg.
   ========================================================================== */

(function () {
  'use strict';

  const NS = (window.ILP = window.ILP || {});

  // Heurística: si el texto decodificado como utf-8 contiene secuencias
  // de reemplazo (U+FFFD) o caracteres típicos de mojibake de windows-1252
  // tratados como utf-8, entonces reintentar con windows-1252.
  function looksLikeMojibke(text) {
    if (!text) return false;
    let score = 0;
    // Patrones típicos: Ã + vocal = á/é/í/ó/ú; Â + símbolo = espacio extra; ¿ invertidos
    const patterns = [/Ã¡/g, /Ã©/g, /Ã­/g, /Ã³/g, /Ãº/g, /Ã±/g, /Ã€/g, /Â°/g, /Âª/g, /Ã§/g];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) score += m.length;
    }
    return score > 2;
  }

  function hasReplacementChar(text) {
    return /\uFFFD/.test(text);
  }

  /**
   * Decodifica un ArrayBuffer usando la mejor heurística.
   * @param {ArrayBuffer} buffer
   * @returns {{ text: string, encoding: string }}
   */
  NS.decodeBuffer = function decodeBuffer(buffer) {
    try {
      // Primero utf-8 estricto
      const utf8Strict = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (!hasReplacementChar(utf8Strict) && !looksLikeMojibke(utf8Strict)) {
        return { text: utf8Strict, encoding: 'utf-8' };
      }
    } catch (_) {
      // fatal: true tiró → no es utf-8 válido
    }
    // Fallback windows-1252
    try {
      const win = new TextDecoder('windows-1252').decode(buffer);
      return { text: win, encoding: 'windows-1252' };
    } catch (_) {
      // Último fallback
      const lossy = new TextDecoder('utf-8').decode(buffer);
      return { text: lossy, encoding: 'utf-8-lossy' };
    }
  };

  /**
   * Background fetch helper to bypass CORS cross-origin blocks.
   * Performs direct fetch if same-origin to bypass background worker SSL certificate blocks.
   */
  NS.bgFetch = function bgFetch(url, options = {}) {
    let targetUrl;
    try {
      targetUrl = new URL(url, window.location.href);
    } catch (_) {
      targetUrl = null;
    }

    if (targetUrl && targetUrl.host === window.location.host) {
      const fetchOpts = {
        method: options.method || 'GET',
        credentials: 'include',
        headers: options.headers || {}
      };
      
      if (options.body) {
        fetchOpts.body = options.body;
      }
      
      if (fetchOpts.method === 'POST') {
        if (!fetchOpts.headers['Content-Type']) {
          fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
      
      return window.fetch(targetUrl.href, fetchOpts);
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'bgFetch',
        url: url,
        method: options.method || 'GET',
        body: options.body || null
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(new Error(response?.error || 'Error al conectar con el servidor de InfoLeg.'));
          return;
        }
        const buffer = new Uint8Array(response.bytes).buffer;
        resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          arrayBuffer: () => Promise.resolve(buffer),
          text: () => Promise.resolve(new TextDecoder('utf-8').decode(buffer))
        });
      });
    });
  };

  /**
   * Convierte HTML a texto plano preservando saltos de línea según
   * la estructura del documento (block elements insertan \n, <br> = \n).
   * Decodifica entidades HTML, quita scripts/styles.
   * Las imágenes se preservan como marcadores [ILP-IMAGE: url] cuando
   * se provee un baseUrl para resolver rutas relativas.
   * @param {string} html
   * @param {string} [baseUrl]  URL base para resolver src relativos de <img>
   * @returns {string}
   */
  NS.htmlToText = function htmlToText(html, baseUrl) {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Quitar ruido
    doc.querySelectorAll('script, style, noscript, link, meta').forEach((n) => n.remove());
    const BLOCK = new Set([
      'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE',
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
      'TABLE', 'THEAD', 'TBODY', 'TFOOTER', 'TR',
      'BLOCKQUOTE', 'PRE', 'HR', 'BR',
      'ADDRESS', 'FIGURE', 'FIGCAPTION'
    ]);
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
    const out = [];

    // Precompute the base directory URL once for image resolution
    let baseDir = null;
    if (baseUrl) {
      try {
        const u = new URL(baseUrl);
        // Strip the last path segment to get the folder URL
        u.pathname = u.pathname.replace(/\/[^/]*$/, '/');
        baseDir = u.href;
      } catch (_) { /* ignore */ }
    }

    function resolveImgSrc(src) {
      if (!src) return null;
      if (/^https?:\/\//i.test(src) || /^\/\//i.test(src)) return src;
      if (baseDir) {
        try { return new URL(src, baseDir).href; } catch (_) { /* fall through */ }
      }
      return null;
    }

    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        if (node.parentNode) {
          const parentTag = node.parentNode.tagName;
          if (['TR', 'TABLE', 'TBODY', 'THEAD', 'TFOOTER'].includes(parentTag)) {
            if (!node.nodeValue.trim()) return;
          }
        }
        out.push(node.nodeValue.replace(/\r?\n/g, ' '));
        return;
      }
      if (node.nodeType !== 1) return;
      if (SKIP.has(node.tagName)) return;
      // Imágenes: emitir marcador con URL absoluta
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src');
        const resolved = resolveImgSrc(src);
        if (resolved) {
          out.push(`\n[ILP-IMAGE: ${resolved}]\n`);
        }
        return;
      }
      // Forzar saltos para <br>
      if (node.tagName === 'BR') { out.push('\n'); return; }
      // Tr td: insertar tab
      if (node.tagName === 'TD' || node.tagName === 'TH') {
        for (const c of node.childNodes) walk(c);
        out.push('\t');
        return;
      }
      // Detectar elementos bold/italic que son el único contenido de su padre
      // (título standalone): emitir marcador [ILP-TITLE] para preservar
      // subtítulos y epígrafes que en Infoleg aparecen en negrita o cursiva.
      const isBoldEl = ['B', 'STRONG'].includes(node.tagName) ||
        /font-weight\s*:\s*(bold|700|600)/i.test(node.getAttribute('style') || '');
      const isEmEl = !isBoldEl && (['I', 'EM'].includes(node.tagName) ||
        /font-style\s*:\s*(italic|oblique)/i.test(node.getAttribute('style') || ''));
      if (isBoldEl || isEmEl) {
        const myText = node.textContent.trim();
        const parentText = node.parentNode ? node.parentNode.textContent.trim() : '';
        const isArticleRef = /^(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?|ARTICULO|ART[IÍ]CULO)\s*\d+/i.test(myText);
        if (!isArticleRef && myText.length > 0 && myText.length <= 120 &&
            !myText.includes('\n') && parentText === myText) {
          out.push(`\n[ILP-TITLE: ${myText}]\n`);
          return;
        }
        // Not standalone — fall through to process children normally
      }
      // Block-level: envolver en saltos
      const isBlock = BLOCK.has(node.tagName);
      if (isBlock) out.push('\n');
      for (const c of node.childNodes) walk(c);
      if (isBlock) out.push('\n');
    }
    const body = doc.body || doc.documentElement;
    for (const c of body.childNodes) walk(c);
    let txt = out.join('');
    return txt
      .replace(/\u00a0/g, ' ')         // nbsp → espacio
      .replace(/[ \t]+\n/g, '\n')      // tab/espacios al final de línea
      .replace(/\n[ \t]+/g, '\n')      // indent al inicio
      .replace(/\n{3,}/g, '\n\n')      // max 2 saltos
      .trim();
  };
})();
