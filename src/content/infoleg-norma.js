/* ==========================================================================
   Leyes-Plus Argentina — Standalone Norma Reader Content Script (verNorma.do)
   ========================================================================== */

(function () {
  'use strict';

  // Bypass if explicitly requested via URL parameter (to see original InfoLeg page)
  if (window.location.search.includes('ilp-bypass=true') || window.location.search.includes('no-ext=true')) {
    return;
  }

  // Avoid running inside the workspace iframe if it is already loaded
  const isIframeMode = (window.parent !== window);
  if (isIframeMode) return;

  const ILP = window.ILP || {};
  const { bgFetch, htmlToText, parser, ui } = ILP;

  const id = (window.location.search.match(/[?&]id=(\d+)/) || [])[1];
  if (!id) return;

  // State Management
  let currentTextType = 'actualizado'; // 'actualizado' (texact.htm) or 'completo' (norma.htm)
  let currentLawMeta = null;
  let currentLawData = {};
  let activeDropdown = null;
  let fontSize = parseInt(localStorage.getItem('ilp-font-size')) || 100;

  // Selectors helpers
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  async function init() {
    // Hide standard Infoleg elements
    document.body.innerHTML = '';
    document.body.classList.add('ilp-reader-active');
    
    // Build root container
    const root = document.createElement('div');
    root.id = 'ilp-reader-root';
    root.className = 'ilp-standalone-mode ilp-root';
    root.setAttribute('data-theme', localStorage.getItem('ilp-theme') || 'light');
    document.body.appendChild(root);

    // Build Reader UI structure
    root.innerHTML = `
      <div class="ilp-reader-toolbar">
        <div class="ilp-ws-logo" style="margin-right: 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:#5850ec;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span style="font-weight:700;font-size:0.9rem;background:linear-gradient(to right, #1c1917, #5850ec);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Leyes-Plus Argentina</span>
        </div>
        <div class="ilp-ws-reader-meta" style="margin-right: auto;display:flex;align-items:center;gap:10px;">
          <span id="ilp-ws-reader-law-type" style="font-size:0.7rem;color:#fff;background-color:#5850ec;padding:2px 8px;border-radius:6px;text-transform:uppercase;font-weight:700;">-</span>
          <span id="ilp-ws-reader-law-num" style="font-weight:700;font-size:0.95rem;color:#1c1917;">-</span>
        </div>
        <div class="ilp-ws-reader-actions" style="display:flex;align-items:center;gap:12px;">
          <div class="ilp-ws-toggle-group">
            <button id="ilp-ws-ver-actualizado" class="active">Texto Actualizado</button>
            <button id="ilp-ws-ver-completo">Texto Original</button>
          </div>
          
          <div class="ilp-dropdown-container">
            <button id="ilp-ws-rel-modifica" class="ilp-dropdown-btn">Modifica a <span class="badge">0</span></button>
            <div id="ilp-ws-menu-modifica" class="ilp-dropdown-menu hidden"></div>
          </div>
          
          <div class="ilp-dropdown-container">
            <button id="ilp-ws-rel-modificada-por" class="ilp-dropdown-btn">Modificada por <span class="badge">0</span></button>
            <div id="ilp-ws-menu-modificada-por" class="ilp-dropdown-menu hidden"></div>
          </div>

          <button id="ilp-ws-font-dec" class="ilp-btn" title="Reducir letra" style="padding: 6px 10px;">A-</button>
          <button id="ilp-ws-font-inc" class="ilp-btn" title="Aumentar letra" style="padding: 6px 10px;">A+</button>
          <button id="ilp-ws-copy-cite" class="ilp-btn" title="Copiar Cita">Copiar Cita</button>
          <button id="ilp-ws-export-pdf" class="ilp-btn" title="Exportar a PDF">PDF</button>
          <button id="ilp-ws-export-docx" class="ilp-btn" title="Exportar a Word (DOCX)">Word</button>
          <button id="ilp-ws-theme-toggle" class="ilp-btn-icon" title="Cambiar tema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 18.36l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <button id="ilp-ws-back-portal" class="ilp-btn">Volver al Portal</button>
        </div>
      </div>
      <div class="ilp-reader-body">
        <div id="ilp-ws-reader-content">
          <div class="ilp-reader-loading">Consultando detalles de la norma...</div>
        </div>
        <button class="ilp-back-to-top" id="ilp-ws-back-to-top" title="Volver al inicio" aria-label="Volver al inicio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>
        </button>
      </div>
    `;

    // Event Listeners
    qs('#ilp-ws-theme-toggle', root).addEventListener('click', cycleTheme);
    qs('#ilp-ws-back-portal', root).addEventListener('click', () => {
      const proto = window.location.protocol;
      window.location.href = `${proto}//www.infoleg.gob.ar/`;
    });

    // Version buttons toggle
    qs('#ilp-ws-ver-actualizado', root).addEventListener('click', () => {
      if (currentTextType === 'actualizado') return;
      currentTextType = 'actualizado';
      qs('#ilp-ws-ver-actualizado', root).classList.add('active');
      qs('#ilp-ws-ver-completo', root).classList.remove('active');
      renderCurrentLawText();
    });
    qs('#ilp-ws-ver-completo', root).addEventListener('click', () => {
      if (currentTextType === 'completo') return;
      currentTextType = 'completo';
      qs('#ilp-ws-ver-completo', root).classList.add('active');
      qs('#ilp-ws-ver-actualizado', root).classList.remove('active');
      renderCurrentLawText();
    });

    // Dropdowns toggles
    setupDropdownToggle(qs('#ilp-ws-rel-modifica', root), qs('#ilp-ws-menu-modifica', root));
    setupDropdownToggle(qs('#ilp-ws-rel-modificada-por', root), qs('#ilp-ws-menu-modificada-por', root));

    // Font settings
    const applyFontSettings = () => {
      const content = qs('#ilp-ws-reader-content');
      if (content) {
        content.style.fontSize = `${fontSize}%`;
      }
    };

    qs('#ilp-ws-font-dec', root).addEventListener('click', () => {
      if (fontSize > 70) {
        fontSize -= 10;
        localStorage.setItem('ilp-font-size', fontSize);
        applyFontSettings();
      }
    });
    qs('#ilp-ws-font-inc', root).addEventListener('click', () => {
      if (fontSize < 160) {
        fontSize += 10;
        localStorage.setItem('ilp-font-size', fontSize);
        applyFontSettings();
      }
    });

    // Copy Citation
    qs('#ilp-ws-copy-cite', root).addEventListener('click', copyCiteToClipboard);

    // Exports
    qs('#ilp-ws-export-pdf', root).addEventListener('click', handleExportPDF);
    qs('#ilp-ws-export-docx', root).addEventListener('click', handleExportDOCX);

    // Back-to-top wedge button: show on scroll, click → scroll to top
    const backToTopBtn = qs('#ilp-ws-back-to-top', root);
    const scrollBody = qs('.ilp-reader-body', root);
    if (backToTopBtn && scrollBody) {
      scrollBody.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('visible', scrollBody.scrollTop > 300);
      }, { passive: true });
      backToTopBtn.addEventListener('click', () => {
        scrollBody.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Close dropdowns on document click
    document.addEventListener('click', (e) => {
      if (activeDropdown && !e.target.closest('.ilp-dropdown-container')) {
        activeDropdown.classList.add('hidden');
        activeDropdown = null;
      }
    });

    // Load actual data
    await loadLawDetails();
  }

  function setupDropdownToggle(btn, menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeDropdown && activeDropdown !== menu) {
        activeDropdown.classList.add('hidden');
      }
      menu.classList.toggle('hidden');
      activeDropdown = menu.classList.contains('hidden') ? null : menu;
    });
  }

  function cycleTheme() {
    const root = qs('#ilp-reader-root');
    const themes = ['light', 'sepia', 'dark'];
    let cur = root.getAttribute('data-theme') || 'light';
    let idx = (themes.indexOf(cur) + 1) % themes.length;
    let nextTheme = themes[idx];
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('ilp-theme', nextTheme);
  }

  // -----------------------------------------------------------------------
  // Details Fetching
  // -----------------------------------------------------------------------
  async function loadLawDetails() {
    const contentArea = qs('#ilp-ws-reader-content');
    try {
      const url = window.location.href;
      const res = await bgFetch(url);
      const buffer = await res.arrayBuffer();
      const { text: html } = ILP.decodeBuffer(buffer);

      const parserDoc = new DOMParser();
      const doc = parserDoc.parseFromString(html, 'text/html');

      const anchors = Array.from(doc.querySelectorAll('a'));
      let textUrl = '';
      let originalTextUrl = '';

      for (const a of anchors) {
        const h = a.getAttribute('href') || '';
        if (h.includes('texact.htm')) {
          textUrl = new URL(h, url).href;
        }
        if (h.includes('norma.htm') || /Texto\s+completo/i.test(a.textContent)) {
          originalTextUrl = new URL(h, url).href;
        }
      }

      // Default fallback using predictable pathing
      const n = Number(id);
      const start = Math.floor(n / 5000) * 5000;
      const end = start + 4999;
      if (!originalTextUrl) {
        originalTextUrl = `https://servicios.infoleg.gob.ar/infolegInternet/anexos/${start}-${end}/${id}/norma.htm`;
      }
      if (!textUrl) {
        textUrl = `https://servicios.infoleg.gob.ar/infolegInternet/anexos/${start}-${end}/${id}/texact.htm`;
      }

      // Extract general metadata
      const extractLabel = (regex) => {
        const m = html.match(regex);
        return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
      };

      const numero = extractLabel(/N[uú]mero(?:\s*de\s*Norma)?[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i) || id;
      const tipo = extractLabel(/Tipo\s*(?:de\s*Norma)?[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i) || 'Norma';
      const sancion = extractLabel(/Sanci[oó]n[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);
      const publicacion = extractLabel(/Publicaci[oó]n[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);
      const organismo = extractLabel(/Organismo\s*Emisor[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);

      let title = doc.querySelector('title')?.textContent.trim() || '';
      if (/^infoleg/i.test(title)) title = '';
      if (!title) {
        const firstB = doc.querySelector('b');
        title = firstB ? firstB.textContent.trim() : `${tipo} ${numero}`;
      }

      currentLawMeta = {
        id,
        tipo,
        numero,
        sancion,
        publicacion,
        organismo,
        titulo: title,
        url,
        textUrl,
        originalTextUrl
      };

      // Set Toolbar details
      qs('#ilp-ws-reader-law-type').textContent = tipo;
      qs('#ilp-ws-reader-law-num').textContent = `N° ${numero}`;

      // Reset and load actual text
      currentLawData = {};
      await fetchAndParseText(textUrl, originalTextUrl);

      // Async fetch relationships links (vinculos)
      fetchLawRelationships(id);
    } catch (err) {
      console.error('Error loading law details:', err);
      contentArea.innerHTML = '<div class="ilp-reader-loading">Error al cargar los detalles de esta norma. ¿Tiene conexión a internet?</div>';
    }
  }

  async function fetchAndParseText(updatedUrl, originalUrl) {
    const contentArea = qs('#ilp-ws-reader-content');
    contentArea.innerHTML = '<div class="ilp-reader-loading">Descargando y formateando texto normativo...</div>';

    const targetUrl = currentTextType === 'actualizado' ? updatedUrl : originalUrl;

    try {
      const res = await bgFetch(targetUrl);
      
      if (!res.ok && currentTextType === 'actualizado') {
        currentTextType = 'completo';
        qs('#ilp-ws-ver-completo').classList.add('active');
        qs('#ilp-ws-ver-actualizado').classList.remove('active');
        return fetchAndParseText(updatedUrl, originalUrl);
      }

      const buffer = await res.arrayBuffer();
      const { text: rawHtml } = ILP.decodeBuffer(buffer);

      const cleanRaw = htmlToText(rawHtml, targetUrl);
      if (cleanRaw.length < 60 || /no se pudo acceder al archivo solicitado/i.test(rawHtml)) {
        throw new Error('Contenido no usable');
      }
      currentLawData[currentTextType] = parser.parseLawText(cleanRaw);

      renderCurrentLawText();
    } catch (err) {
      console.warn('Fallback to verNorma parsing due to file loading issue:', err);
      try {
        const fallbackUrl = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${id}`;
        const res = await bgFetch(fallbackUrl);
        const buffer = await res.arrayBuffer();
        const { text: html } = ILP.decodeBuffer(buffer);
        const textClean = htmlToText(html, fallbackUrl);
        currentLawData[currentTextType] = parser.parseLawText(textClean);
        renderCurrentLawText();
      } catch (innerErr) {
        contentArea.innerHTML = '<div class="ilp-reader-loading">No se pudo cargar el cuerpo del texto para esta norma. El archivo podría no estar digitalizado en InfoLeg.</div>';
      }
    }
  }

  /**
   * Convierte texto con marcadores [ILP-IMAGE: url] en HTML con etiquetas
   * <img> estilizadas. Escapa el resto del texto para prevenir XSS.
   */
  function formatTextWithImages(text) {
    if (!text) return '';
    const emphasizeInlineTitleSentence = (escapedLine) => {
      return escapedLine.replace(/(^|[.!?]\s+)([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+(?:de|del|la|las|el|los|y|en|para|por|a|al|[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,})){1,5})\.(?=\s+[A-ZÁÉÍÓÚÑ])/g, (m, prefix, phrase) => {
        const words = phrase.trim().split(/\s+/).length;
        if (words < 2 || words > 6) return m;
        if (/\b(es|son|ser[aá]n?|fue|fueron|ser[aá]|debe|deber[aá]|podr[aá]|podr[aá]n|qued[aá])\b/i.test(phrase)) return m;
        return `${prefix}<span class="ilp-inline-subtitle">${phrase}.</span> `;
      });
    };

    const isInlineStructuralLine = (line) => {
      const trimmed = (line || '').trim();
      if (!trimmed) return false;
      if (/^\[ILP-IMAGE:/i.test(trimmed)) return false;
      if (/^(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?)\b/i.test(trimmed)) return false;
      if (/^\(/.test(trimmed) || /[,:;]/.test(trimmed)) return false;
      if (trimmed.length > 80) return false;
      if (parser.isStructuralHeader(trimmed)) return true;
      const isUpperTitle = trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed);
      return isUpperTitle && trimmed.split(/\s+/).length <= 6;
    };

    const isInlineSubtitleLine = (line) => {
      const trimmed = (line || '').trim();
      if (!trimmed) return false;
      if (/^\[ILP-IMAGE:/i.test(trimmed)) return false;
      if (/^(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?)\b/i.test(trimmed)) return false;
      if (/[,:;]/.test(trimmed)) return false;
      if (/^\(/.test(trimmed)) return false;
      if (trimmed.length > 50) return false;
      if (!parser.isSubtitleLine(trimmed)) return false;
      if (/\b(ser[aá]n?|podr[aá]n?|deber[aá]|quedar[aá]|establece|dispone|conforme|tiene|tienen|puede|pueden|debe|deben)\b/i.test(trimmed)) return false;
      return true;
    };

    return text
      .split('\n')
      .map((line) => {
        if (line.trim() === '[ILP-PARA]') return '';
        const titleMatch = line.match(/^\[ILP-TITLE:\s*(.+?)\]$/);
        if (titleMatch) {
          const rawTitle = titleMatch[1].trim();
          const esc = rawTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return parser.isStructuralHeader(rawTitle)
            ? `<span class="ilp-inline-structural">${esc}</span>`
            : `<span class="ilp-inline-subtitle">${esc}</span>`;
        }
        const imgMatch = line.match(/^\[ILP-IMAGE:\s*(.+?)\]$/);
        if (imgMatch) {
          const url = imgMatch[1].trim();
          return `<img src="${url}" class="ilp-embedded-image" alt="Anexo gráfico" loading="lazy" />`;
        }
        // Escape HTML in plain text lines
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (isInlineStructuralLine(line)) {
          return `<span class="ilp-inline-structural">${escaped}</span>`;
        }
        if (isInlineSubtitleLine(line)) {
          return `<span class="ilp-inline-subtitle">${escaped}</span>`;
        }
        return emphasizeInlineTitleSentence(escaped);
      })
      .join('<br/>');
  }

  function renderCurrentLawText() {
    const contentArea = qs('#ilp-ws-reader-content');
    const data = currentLawData[currentTextType];
    const meta = currentLawMeta;

    if (!data) {
      fetchAndParseText(meta.textUrl, meta.originalTextUrl);
      return;
    }

    let metaHtml = '';
    if (meta.sancion || meta.publicacion || meta.organismo) {
      metaHtml = `
        <div class="ilp-law-meta-subtitle">
          ${meta.organismo ? `<span><strong>Organismo:</strong> ${meta.organismo}</span>` : ''}
          ${meta.sancion ? `<span><strong>Sancionada:</strong> ${meta.sancion}</span>` : ''}
          ${meta.publicacion ? `<span><strong>Publicada:</strong> ${meta.publicacion}</span>` : ''}
        </div>
      `;
    }

    let artHtml = '';
    if (data.articles && data.articles.length > 0) {
      data.articles.forEach((art) => {
        let headersHtml = '';
        if (art.headers && art.headers.length > 0) {
          art.headers.forEach((h) => {
            if (h === '[ILP-PARA]') return;
            const displayH = parser.unwrapTitleMarker(h);
            if (parser.isStructuralHeader(displayH)) {
              headersHtml += `<h2>${displayH}</h2>`;
            } else {
              headersHtml += `<h3>${displayH}</h3>`;
            }
          });
        }

        artHtml += `
          ${headersHtml}
          <div class="ilp-art">
            <strong>${art.prefix}</strong>
            <p>${formatTextWithImages(art.text)}</p>
          </div>
        `;
      });
    } else {
      artHtml = `<p>${formatTextWithImages(data.preamble || '')}</p>`;
    }

    contentArea.innerHTML = `
      <h1>${meta.titulo || data.title}</h1>
      ${metaHtml}
      <div class="ilp-law-body-wrapper">
        ${artHtml}
      </div>
      ${data.footer ? `<div class="ilp-law-footer-notes" style="margin-top:40px;border-top:1px solid var(--ilp-border);padding-top:20px;font-size:0.85rem;color:var(--ilp-text-1);">${data.footer.replace(/\n+/g, '<br/>')}</div>` : ''}
    `;
    contentArea.style.fontSize = `${fontSize}%`;
    qs('.ilp-reader-body').scrollTop = 0;
  }

  // -----------------------------------------------------------------------
  // Related Regulations Drops Scraping
  // -----------------------------------------------------------------------
  async function fetchLawRelationships(id) {
    loadRelationshipMode(id, 1, qs('#ilp-ws-rel-modifica'), qs('#ilp-ws-menu-modifica'));
    loadRelationshipMode(id, 2, qs('#ilp-ws-rel-modificada-por'), qs('#ilp-ws-menu-modificada-por'));
  }

  async function loadRelationshipMode(id, modo, btn, menu) {
    try {
      const res = await bgFetch(`https://servicios.infoleg.gob.ar/infolegInternet/verVinculos.do?modo=${modo}&id=${id}`);
      if (!res.ok) return;

      const buffer = await res.arrayBuffer();
      const { text: html } = ILP.decodeBuffer(buffer);

      const list = parseVinculosHTML(html);
      
      btn.querySelector('.badge').textContent = list.length;
      
      if (list.length === 0) {
        menu.innerHTML = '<div style="padding:12px;font-size:0.75rem;color:var(--ilp-text-2);text-align:center;">Sin relaciones cargadas.</div>';
        return;
      }

      menu.innerHTML = '';
      list.forEach((v) => {
        const item = document.createElement('button');
        item.className = 'ilp-dropdown-item';
        item.innerHTML = `
          <strong>${v.tipo} N° ${v.numero}</strong>
          <span>${v.titulo}</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          menu.classList.add('hidden');
          activeDropdown = null;
          // Standalone navigation redirect
          window.location.href = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${v.id}`;
        });
        menu.appendChild(item);
      });
    } catch (err) {
      console.warn(`Failed loading relationships mode ${modo}:`, err);
    }
  }

  function parseVinculosHTML(html) {
    const parserDoc = new DOMParser();
    const doc = parserDoc.parseFromString(html, 'text/html');
    const out = [];
    const seen = new Set();
    const rows = doc.querySelectorAll('tr');

    rows.forEach((row) => {
      const link = row.querySelector('a[href*="verNorma.do"]');
      if (!link) return;

      const m = link.getAttribute('href').match(/[?&]id=(\d+)/i);
      if (!m) return;

      const vincId = m[1];
      if (seen.has(vincId)) return;
      seen.add(vincId);

      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        const leftText = cells[0].textContent.trim();
        const numero = leftText.match(/(\d+)/)?.[1] || vincId;
        const tipo = leftText.match(/^(Ley|Decreto|Resoluci[oó]n|Disposici[oó]n|Decisi[oó]n\s+Administrativa|Acordada|Acta|Acuerdo|Circular|Circular|Comunicaci[oó]n|Decreto\/Ley)/i)?.[1] || 'Norma';
        const desc = cells[2].textContent.trim();

        out.push({
          id: vincId,
          numero,
          tipo,
          titulo: desc
        });
      }
    });

    return out;
  }

  async function copyCiteToClipboard() {
    if (!currentLawMeta) return;
    const meta = currentLawMeta;
    const typeLabel = currentTextType === 'actualizado' ? 'Texto Actualizado' : 'Texto Original';
    const citation = `${meta.tipo} N° ${meta.numero} (B.O. ${meta.publicacion || 'N/D'}) - ${meta.titulo}. Enlace oficial: ${meta.url} (${typeLabel})`;
    
    try {
      if (ui && typeof ui.copyToClipboard === 'function') {
        await ui.copyToClipboard(citation);
        ui.toast('Cita oficial copiada al portapapeles');
      } else {
        await navigator.clipboard.writeText(citation);
        alert('Cita oficial copiada al portapapeles');
      }
    } catch (err) {
      console.error('Failed to copy citation:', err);
    }
  }

  async function handleExportPDF() {
    const data = currentLawData[currentTextType];
    if (!data) return;
    try {
      const lawData = {
        title: currentLawMeta.titulo || data.title,
        preamble: data.preamble,
        articles: data.articles,
        footer: data.footer
      };

      if (ui && typeof ui.toast === 'function') {
        ui.toast('Generando PDF...');
      }

      chrome.runtime.sendMessage({ action: 'exportPDF', lawData }, (response) => {
        if (response && response.success && response.dataUri) {
          const a = document.createElement('a');
          a.href = response.dataUri;
          a.download = `${currentLawMeta.tipo}_${currentLawMeta.numero}.pdf`.replace(/\s+/g, '_');
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (ui && typeof ui.toast === 'function') {
            ui.toast('PDF descargado con éxito');
          }
        } else {
          throw new Error(response ? response.error : 'Respuesta vacía');
        }
      });
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      if (ui && typeof ui.toast === 'function') {
        ui.toast('Error al exportar PDF', 'error');
      } else {
        alert('Error al exportar PDF: ' + err.message);
      }
    }
  }

  async function handleExportDOCX() {
    const data = currentLawData[currentTextType];
    if (!data) return;
    try {
      const lawData = {
        title: currentLawMeta.titulo || data.title,
        preamble: data.preamble,
        articles: data.articles,
        footer: data.footer
      };

      if (ui && typeof ui.toast === 'function') {
        ui.toast('Generando Word (DOCX)...');
      }

      chrome.runtime.sendMessage({ action: 'exportDOCX', lawData }, (response) => {
        if (response && response.success && response.base64) {
          const byteArray = Uint8Array.from(atob(response.base64), (c) => c.charCodeAt(0));
          const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${currentLawMeta.tipo}_${currentLawMeta.numero}.docx`.replace(/\s+/g, '_');
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (ui && typeof ui.toast === 'function') {
            ui.toast('Word descargado con éxito');
          }
        } else {
          throw new Error(response ? response.error : 'Respuesta vacía');
        }
      });
    } catch (err) {
      console.error('Error al exportar DOCX:', err);
      if (ui && typeof ui.toast === 'function') {
        ui.toast('Error al exportar Word', 'error');
      } else {
        alert('Error al exportar Word: ' + err.message);
      }
    }
  }

  // DOM Trigger
  chrome.storage.local.get('ilp-enabled', (data) => {
    if (data['ilp-enabled'] === false) {
      console.log('[ILP] InfoLeg-Plus reader is disabled.');
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
})();
