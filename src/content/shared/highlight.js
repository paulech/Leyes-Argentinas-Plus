/* ==========================================================================
   Leyes-Plus Argentina — Shared module: highlight
   Búsqueda in-text con resaltado y navegación prev/next.
   ========================================================================== */

(function () {
  'use strict';

  const NS = (window.ILP = window.ILP || {});

  const CSS_MATCH = 'ilp-text-match';
  const CSS_CURRENT = 'ilp-current-match';

  function escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  /**
   * Resalta todas las ocurrencias de `query` dentro de `root`.
   * @returns {Array<HTMLElement>} nodos <mark> creados
   */
  function highlight(root, query) {
    clear(root);
    if (!query || query.trim().length < 2) return [];
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains(CSS_MATCH) || p.classList.contains('ilp-art-action-btn'))) {
          return NodeFilter.FILTER_REJECT;
        }
        return regex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach((node) => {
      const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
      const text = node.nodeValue;
      const f = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = re.exec(text))) {
        if (m.index > last) f.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = CSS_MATCH;
        mark.textContent = m[0];
        f.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (last < text.length) f.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(f, node);
    });

    return Array.from(root.querySelectorAll(`mark.${CSS_MATCH}`));
  }

  function clear(root) {
    if (!root) return;
    Array.from(root.querySelectorAll(`mark.${CSS_MATCH}`)).forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  NS.highlight = {
    highlight,
    clear,
    CSS_MATCH,
    CSS_CURRENT
  };
})();
