/* ==========================================================================
   Córdoba Leyes Reader Pro - Content Script (Versión 0.2.0)
   Arquitectura Optimizada: Vanilla JS + Lazy Loading
   ========================================================================== */

(function () {
  'use strict';

  // Bypass if explicitly requested via URL parameter (to see original Córdoba page)
  if (window.location.search.includes('ilp-bypass=true') || window.location.search.includes('no-ext=true')) {
    return;
  }

  const ILP = window.ILP || {};

  if (!ILP.parser || !ILP.decodeBuffer || !ILP.bgFetch || !ILP.htmlToText) {
    console.error('[ILP-Cordoba] Shared modules no disponibles. Abortando.');
    return;
  }

let parsedLawData = {
  title: 'Normativa de Córdoba',
  preamble: '',
  articles: [],
  footer: ''
};

let textMatches = [];
let currentMatchIndex = -1;
let loadedLawId = null;

function parseNormTypeAndNumber(rawText) {
  if (!rawText) return null;
  const sample = rawText.slice(0, 3000);
  
  // 1. Direct matching like "LEY N° 8465"
  const regexNormaDirect = /\b(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N|DECISI[ÓO]N|ACORDADA)\s*(?:N[°º°ª\.]*|Nro\.?|N[úu]m\.?)?\s*([0-9\.\-\/]+)\b/i;
  const matchDirect = sample.match(regexNormaDirect);
  if (matchDirect) {
    return {
      tipo: capitalizeFirstLetter(matchDirect[1]),
      numero: matchDirect[2]
    };
  }

  // 2. Multiline/split matching:
  // LEY
  // Número:
  // 8465
  const regexNormaSplit = /\b(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N|DECISI[ÓO]N|ACORDADA)\s*\n\s*N[úu]mero:\s*\n\s*([0-9\.\-\/]+)\b/i;
  const matchSplit = sample.match(regexNormaSplit);
  if (matchSplit) {
    return {
      tipo: capitalizeFirstLetter(matchSplit[1]),
      numero: matchSplit[2]
    };
  }
  
  // 3. Normalized whitespace matching for "LEY Número: 8465"
  const regexNormaWhitespace = /\b(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N|DECISI[ÓO]N|ACORDADA)\s+N[úu]mero:\s+([0-9\.\-\/]+)\b/i;
  const matchWhitespace = sample.replace(/\s+/g, ' ').match(regexNormaWhitespace);
  if (matchWhitespace) {
    return {
      tipo: capitalizeFirstLetter(matchWhitespace[1]),
      numero: matchWhitespace[2]
    };
  }

  // 4. Consecutive lines: LEY followed by a number line
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 25);
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (/^(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N|DECISI[ÓO]N|ACORDADA)$/i.test(line)) {
      const nextLine = lines[i+1];
      if (/^[0-9\.\-\/]+$/.test(nextLine)) {
        return {
          tipo: capitalizeFirstLetter(line),
          numero: nextLine
        };
      }
      if (i + 2 < lines.length) {
        const nextNextLine = lines[i+2];
        if (/^[0-9\.\-\/]+$/.test(nextNextLine)) {
          return {
            tipo: capitalizeFirstLetter(line),
            numero: nextNextLine
          };
        }
      }
    }
  }

  return null;
}

function capitalizeFirstLetter(string) {
  if (!string) return '';
  const lower = string.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseFrequentLawTitle(title) {
  if (!title) {
    return {
      tipo: "Norma",
      numero: "",
      titulo: "Normativa de Córdoba"
    };
  }
  
  title = title.trim();
  
  if (title.includes("Constitución")) {
    return {
      tipo: "Const.",
      numero: "Provincial",
      titulo: title
    };
  }
  
  // Try pattern with dash (e.g., "Ley 8435 - Ley Orgánica...")
  const dashMatch = title.match(/^(Ley|Decreto|Resoluci[oó]n|Disposici[oó]n|Decisi[oó]n|Acordada|C[oó]digo|Const\.)\s*(?:N[°º°ª\.]*|Nro\.?|N[úu]m\.?)?\s*([0-9\.\/]+)\s*[-–]\s*(.*)$/i);
  if (dashMatch) {
    return {
      tipo: dashMatch[1],
      numero: dashMatch[2],
      titulo: dashMatch[3].trim()
    };
  }
  
  // Try pattern without dash (e.g., "LEY N° 8465")
  const noDashMatch = title.match(/^(Ley|Decreto|Resoluci[oó]n|Disposici[oó]n|Decisi[oó]n|Acordada|C[oó]digo|Const\.)\s*(?:N[°º°ª\.]*|Nro\.?|N[úu]m\.?)?\s*([0-9\.\/]+)\s*(.*)$/i);
  if (noDashMatch) {
    const rest = noDashMatch[4].trim();
    return {
      tipo: noDashMatch[1],
      numero: noDashMatch[2],
      titulo: rest || `${noDashMatch[1]} N° ${noDashMatch[2]}`
    };
  }
  
  return {
    tipo: "Norma",
    numero: "",
    titulo: title
  };
}


function renderFrequentLaws() {
  const container = document.getElementById('cba-frequent-list');
  const select = document.getElementById('cba-frequent-category-select');
  if (!container || !select) return;

  const category = select.value;
  const list = FREQUENT_LAWS[category] || [];

  container.innerHTML = '';
  
  if (list.length === 0) {
    container.innerHTML = '<div class="cba-results-placeholder" style="padding: 10px 0;">No hay normas en esta categoría.</div>';
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cba-result-card';
    card.dataset.id = item.id;
    card.dataset.ori = item.ori;
    
    if (item.id === loadedLawId) {
      card.classList.add('active');
    }

    const itemParsed = parseFrequentLawTitle(item.title);
    
    const metaHtml = [
      itemParsed.numero ? `<span class="cba-meta-item">N° ${itemParsed.numero}</span>` : null,
      `<span class="cba-meta-item">${itemParsed.tipo}</span>`
    ].filter(Boolean).join('');

    card.innerHTML = `
      <div class="cba-result-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; width: 100%;">
        <span class="cba-results-card-badge">${itemParsed.tipo}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="cba-result-card-meta" style="margin-bottom: 0;">${metaHtml}</div>
          <button class="cba-new-tab-btn" title="Abrir en nueva pestaña">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        </div>
      </div>
      <h5 class="cba-result-card-title">${itemParsed.titulo}</h5>
    `;

    const newTabBtn = card.querySelector('.cba-new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const viewPath = (item.id === 'CP00') ? '6dd74b426f288a67032572340058a003' : (item.ori === '0' || item.id.length === 32 ? '0' : (item.ori === 'D' ? 'e2911dff3722eec50325724a006a2da0' : '6dd74b426f288a67032572340058a003'));
        const rawUrl = `/web/leyes.nsf/${viewPath}/${item.id}?OpenDocument`;
        window.open(normalizeUrl(rawUrl), '_blank');
      });
    }

    card.addEventListener('click', () => {
      document.querySelectorAll('.cba-result-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      loadedLawId = item.id;
      loadLawInViewer(item.id, item.ori, itemParsed.titulo);
    });

    container.appendChild(card);
  });
}

function addToRecentLaws(id, metadata) {
  if (!id) return;
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('cba-recent-laws')) || [];
  } catch (_) {}

  list = list.filter(item => item.id !== id);

  list.unshift({
    id: id,
    tipo: metadata.tipo || 'Norma',
    numero: metadata.numero || '',
    titulo: metadata.titulo || `Norma N° ${metadata.numero || ''}`,
    ori: metadata.ori || '0'
  });

  if (list.length > 8) {
    list = list.slice(0, 8);
  }

  try {
    localStorage.setItem('cba-recent-laws', JSON.stringify(list));
  } catch (_) {}

  renderRecentLaws();
}

function renderRecentLaws() {
  const container = document.getElementById('cba-recent-list');
  if (!container) return;

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('cba-recent-laws')) || [];
    const cleaned = list.filter(item => item.titulo && item.titulo.toLowerCase() !== 'norma' && item.titulo.toLowerCase() !== 'normativa de córdoba');
    if (cleaned.length !== list.length) {
      list = cleaned;
      localStorage.setItem('cba-recent-laws', JSON.stringify(list));
    }
  } catch (_) {}

  container.innerHTML = '';
  
  if (list.length === 0) {
    container.innerHTML = '<div class="cba-results-placeholder" style="padding: 10px 0;">No hay normas vistas recientemente.</div>';
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cba-result-card';
    card.dataset.id = item.id;
    card.dataset.ori = item.ori;
    
    if (item.id === loadedLawId) {
      card.classList.add('active');
    }

    const metaHtml = [
      item.numero ? `<span class="cba-meta-item">N° ${item.numero}</span>` : null,
      `<span class="cba-meta-item">${item.tipo}</span>`
    ].filter(Boolean).join('');

    card.innerHTML = `
      <div class="cba-result-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; width: 100%;">
        <span class="cba-results-card-badge">${item.tipo}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="cba-result-card-meta" style="margin-bottom: 0;">${metaHtml}</div>
          <button class="cba-new-tab-btn" title="Abrir en nueva pestaña">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        </div>
      </div>
      <h5 class="cba-result-card-title">${item.titulo}</h5>
    `;

    const newTabBtn = card.querySelector('.cba-new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const viewPath = (item.id === 'CP00') ? '6dd74b426f288a67032572340058a003' : (item.ori === '0' || item.id.length === 32 ? '0' : (item.ori === 'D' ? 'e2911dff3722eec50325724a006a2da0' : '6dd74b426f288a67032572340058a003'));
        const rawUrl = `/web/leyes.nsf/${viewPath}/${item.id}?OpenDocument`;
        window.open(normalizeUrl(rawUrl), '_blank');
      });
    }

    card.addEventListener('click', () => {
      document.querySelectorAll('.cba-result-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      loadedLawId = item.id;
      loadLawInViewer(item.id, item.ori, item.titulo);
    });

    container.appendChild(card);
  });
}

const settings = {
  theme: localStorage.getItem('cba-reader-theme') || 'light',
  fontSize: parseInt(localStorage.getItem('cba-reader-font-size')) || 100,
  fontFamily: localStorage.getItem('cba-reader-font-family') || 'serif'
};

const FREQUENT_LAWS = {
  "Constitucional y Organización del Estado": [
    { title: "Constitución de la Provincia de Córdoba", id: "CP00", ori: "L" },
    { title: "Ley 8435 - Ley Orgánica del Poder Judicial", id: "8C28C3EBA0AB9D9C032572340064377D", ori: "0" }
  ],
  "Procedimiento Administrativo": [
    { title: "Ley 5350 - Procedimiento Administrativo", id: "0AFC8C301C28D4CF032584340069B8A3", ori: "0" },
    { title: "Ley 7233 - Estatuto del Personal de la Administración Pública", id: "B4E0D6549A13821503257BE1006695BB", ori: "0" },
    { title: "Ley 8508 - Amparo por mora en la administración", id: "ED22BBC6300F435F03257234006432DB", ori: "0" },
    { title: "Ley 10618 - Ley de Simplificación Administrativa", id: "BE4B01D7CA5875C70325840000588906", ori: "0" }
  ],
  "Derecho Civil, Comercial, Familia y Consumo": [
    { title: "Ley 10247 - Derechos de Consumidores y Usuarios", id: "D9E7D77C1B4F5BA903257DEB0076799E", ori: "0" },
    { title: "Ley 10454 - Ley de Catastro Territorial", id: "4762597AB44FA44A0325865E00525C70", ori: "0" }
  ],
  "Normas Procesales y Métodos Alternativos": [
    { title: "Ley 8465 - Código Procesal Civil y Comercial de Córdoba", id: "19FD5340A2AA7E7003258A2000449696", ori: "0" },
    { title: "Ley 10555 - Procedimiento Oralidad Civil", id: "B7FFB3EE27EB8FD103258942004D744B", ori: "0" },
    { title: "Ley 9459 - Código Arancelario para abogados de Córdoba", id: "9C737A40D78547FD03258C8400401375", ori: "0" },
    { title: "Ley 10543 - Ley de Mediación", id: "18FE6C22A7C0A25B0325833200585E97", ori: "0" },
    { title: "Ley 7182 - Código Contencioso Administrativo de Córdoba", id: "EF9B8FD2619646E403257BE10057A1BE", ori: "0" },
    { title: "Ley 7987 - Código Procesal del Trabajo de Córdoba", id: "64647B903AEC46D0032586A9005B6969", ori: "0" },
    { title: "Ley 10305 - Código de Procedimiento del fuero de Familia", id: "18368E2F1061842303257ED80071D3C3", ori: "0" }
  ],
  "Derecho Penal, Convivencia y Tránsito": [
    { title: "Ley 8560 - Ley de Tránsito", id: "DA71FAD708AFE1E7032589AD0049D381", ori: "0" },
    { title: "Ley 10326 - Código de Convivencia Ciudadana", id: "268c4308c9994d6303258a160050dea6", ori: "0" },
    { title: "Ley 8123 - Código Procesal Penal de Córdoba", id: "34892CF23B741475032586BE00575E42", ori: "0" }
  ],
  "Derecho Tributario y Fiscal": [
    { title: "Ley 6006 - Código Tributario Córdoba", id: "8517AEE2DE1FC2AA03258C3D0056BA50", ori: "0" },
    { title: "Ley 11090 - Ley Impositiva Año 2026", id: "B3BEF084722F5A2603258DA900560F4D", ori: "0" }
  ]
};

function findLawContainer(doc = document) {
  // En portales Lotus Domino (CBA), el texto legislativo suele estar dentro del <form> principal
  const forms = Array.from(doc.querySelectorAll('form'));
  for (const form of forms) {
    const text = form.textContent || '';
    if (text.length > 500 && /(Art[ií]culo|Art\.)\s*\d+/i.test(text)) return form;
  }
  return doc.body;
}

function getRawTextFromDoc(doc = document) {
  const container = findLawContainer(doc);
  const clone = container.cloneNode(true);
  const toRemove = clone.querySelectorAll('script, style, iframe, noscript, nav, header, footer, img, input, button, select');
  toRemove.forEach(el => el.remove());

  // Extrae texto sin mutar masivamente el DOM clonado (evita bloqueos en normas largas).
  const blockTags = new Set(['BR', 'P', 'DIV', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI']);
  const cellTags = new Set(['TD', 'TH']);
  const out = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push((node.nodeValue || '').replace(/\r?\n/g, ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;

    for (const child of node.childNodes) walk(child);

    if (blockTags.has(tag)) out.push('\n');
    else if (cellTags.has(tag)) out.push(' ');
  }

  walk(clone);
  return out.join('');
}

async function renderArticlesChunked() {
  const container = document.getElementById('cba-reader-body-content');
  const navList = document.getElementById('cba-nav-list');
  if (!container || !navList) return;

  container.innerHTML = '';
  navList.innerHTML = '';

  if (parsedLawData.preamble) {
    const preambleDiv = document.createElement('div');
    preambleDiv.className = 'cba-preamble';
    parsedLawData.preamble.split('\n\n').forEach(para => {
      const p = document.createElement('p');
      p.textContent = para;
      preambleDiv.appendChild(p);
    });
    container.appendChild(preambleDiv);
  }

  const BATCH_SIZE = 40;
  let containerFrag = document.createDocumentFragment();
  let navFrag = document.createDocumentFragment();

  const seenNums = new Map();

  for (let i = 0; i < parsedLawData.articles.length; i++) {
    const art = parsedLawData.articles[i];

    const numCount = (seenNums.get(art.num) || 0);
    seenNums.set(art.num, numCount + 1);
    const artId = numCount === 0 ? `art-${art.num}` : `art-${art.num}-${i}`;

    const li = document.createElement('li');
    li.className = 'cba-nav-item';

    const a = document.createElement('a');
    a.className = 'cba-nav-link';
    a.dataset.target = artId;
    a.textContent = art.prefix.trim();
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(artId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.cba-nav-link').forEach(link => link.classList.remove('active'));
        a.classList.add('active');
      }
    });
    li.appendChild(a);
    navFrag.appendChild(li);

    if (art.headers && art.headers.length > 0) {
      art.headers.forEach(header => {
        if (header === '[ILP-PARA]') return;
        const displayH = ILP.parser.unwrapTitleMarker(header);
        if (ILP.parser.isStructuralHeader(displayH)) {
          const headerDiv = document.createElement('div');
          headerDiv.className = 'cba-structural-header';
          headerDiv.textContent = displayH;
          containerFrag.appendChild(headerDiv);
        }
      });
    }

    const section = document.createElement('section');
    section.id = artId;
    section.className = 'law-article';

    if (art.headers && art.headers.length > 0) {
      art.headers.forEach(header => {
        if (header === '[ILP-PARA]') return;
        const displayH = ILP.parser.unwrapTitleMarker(header);
        if (!ILP.parser.isStructuralHeader(displayH)) {
          const subtitleDiv = document.createElement('div');
          subtitleDiv.className = 'cba-article-subtitle';
          subtitleDiv.textContent = displayH;
          section.appendChild(subtitleDiv);
        }
      });
    }

    const header = document.createElement('div');
    header.className = 'law-article-header';
    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    h3.textContent = art.prefix;
    header.appendChild(h3);

    const copyArtBtn = document.createElement('button');
    copyArtBtn.className = 'cba-art-action-btn';
    copyArtBtn.title = 'Copiar artículo';
    copyArtBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875M9 7.875c0-.621.504-1.125 1.125-1.125H18a1.125 1.125 0 011.125 1.125V15c0 .621-.504 1.125-1.125 1.125H10.125A1.125 1.125 0 019 15V7.875z" /></svg>`;
    header.appendChild(copyArtBtn);
    section.appendChild(header);

    const bodyP = document.createElement('p');
    bodyP.className = 'law-article-body';
    bodyP.innerHTML = formatArticleBodyHtml(art.text);
    section.appendChild(bodyP);

    containerFrag.appendChild(section);

    if ((i + 1) % BATCH_SIZE === 0) {
      container.appendChild(containerFrag);
      navList.appendChild(navFrag);
      containerFrag = document.createDocumentFragment();
      navFrag = document.createDocumentFragment();
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (parsedLawData.footer) {
    const footerDiv = document.createElement('div');
    footerDiv.className = 'cba-footer-sig';
    parsedLawData.footer.split('\n\n').forEach(para => {
      const p = document.createElement('p');
      p.textContent = para;
      footerDiv.appendChild(p);
    });
    containerFrag.appendChild(footerDiv);
  }

  container.appendChild(containerFrag);
  navList.appendChild(navFrag);
}

function highlightText(text, query) {
  if (!query) return text;
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<mark class="cba-highlight">$1</mark>');
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isInlineCordobaStructural(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  if (ILP.parser.isStructuralHeader(trimmed)) return true;
  if (/^(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?)\b/i.test(trimmed)) return false;
  if (/^\(/.test(trimmed) || /[,:;]/.test(trimmed)) return false;
  if (trimmed.length > 80) return false;
  const isUpperTitle = trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed);
  return isUpperTitle && trimmed.split(/\s+/).length <= 6;
}

function isInlineCordobaSubtitle(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return false;
  if (isInlineCordobaStructural(trimmed)) return false;
  if (!ILP.parser.isSubtitleLine(trimmed)) return false;
  if (trimmed.length > 50) return false;
  if (/^\(/.test(trimmed) || /[,:;]/.test(trimmed)) return false;
  return true;
}

function formatArticleBodyHtml(text, query = '') {
  if (!text) return '';
  const emphasizeInlineTitleSentence = (lineHtml) => {
    return lineHtml.replace(/(^|[.!?]\s+)([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+(?:de|del|la|las|el|los|y|en|para|por|a|al|[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,})){1,5})\.(?=\s+[A-ZÁÉÍÓÚÑ])/g, (m, prefix, phrase) => {
      const words = phrase.trim().split(/\s+/).length;
      if (words < 2 || words > 6) return m;
      if (/\b(es|son|ser[aá]n?|fue|fueron|ser[aá]|debe|deber[aá]|podr[aá]|podr[aá]n|qued[aá])\b/i.test(phrase)) return m;
      return `${prefix}<span class="cba-inline-subtitle">${phrase}.</span> `;
    });
  };

  return text
    .split('\n')
    .map((line) => {
      if (line.trim() === '[ILP-PARA]') return '';
      const titleMatch = line.match(/^\[ILP-TITLE:\s*(.+?)\]$/);
      if (titleMatch) {
        const rawTitle = titleMatch[1].trim();
        const esc = escapeHtml(rawTitle);
        const rendered = query ? highlightText(esc, query) : esc;
        return ILP.parser.isStructuralHeader(rawTitle)
          ? `<span class="cba-inline-structural">${rendered}</span>`
          : `<span class="cba-inline-subtitle">${rendered}</span>`;
      }
      const escaped = escapeHtml(line);
      const rendered = query ? highlightText(escaped, query) : escaped;
      if (isInlineCordobaStructural(line)) {
        return `<span class="cba-inline-structural">${rendered}</span>`;
      }
      if (isInlineCordobaSubtitle(line)) {
        return `<span class="cba-inline-subtitle">${rendered}</span>`;
      }
      return emphasizeInlineTitleSentence(rendered);
    })
    .join('<br/>');
}

function renderArticles(filterQuery = '') {
  const container = document.getElementById('cba-reader-body-content');
  const navList = document.getElementById('cba-nav-list');
  if (!container || !navList) return;
  
  container.innerHTML = '';
  navList.innerHTML = '';
  
  const containerFrag = document.createDocumentFragment();
  const navFrag = document.createDocumentFragment();

  if (parsedLawData.preamble) {
    const preambleDiv = document.createElement('div');
    preambleDiv.className = 'cba-preamble';
    parsedLawData.preamble.split('\n\n').forEach(para => {
      const p = document.createElement('p');
      if (filterQuery) p.innerHTML = highlightText(para, filterQuery);
      else p.textContent = para;
      preambleDiv.appendChild(p);
    });
    containerFrag.appendChild(preambleDiv);
  }

  const seenNums = new Map();

  parsedLawData.articles.forEach((art, idx) => {
    const numCount = (seenNums.get(art.num) || 0);
    seenNums.set(art.num, numCount + 1);
    const artId = numCount === 0 ? `art-${art.num}` : `art-${art.num}-${idx}`;

    const hasHeaderMatch = art.headers && art.headers.some(h => h.toLowerCase().includes(filterQuery.toLowerCase()));
    const isMatch = !filterQuery ||
                    art.prefix.toLowerCase().includes(filterQuery.toLowerCase()) ||
                    art.text.toLowerCase().includes(filterQuery.toLowerCase()) ||
                    hasHeaderMatch;

    const li = document.createElement('li');
    li.className = 'cba-nav-item';
    if (!isMatch) li.style.display = 'none';

    const a = document.createElement('a');
    a.className = 'cba-nav-link';
    a.dataset.target = artId;
    a.textContent = art.prefix.trim();
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(artId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.cba-nav-link').forEach(link => link.classList.remove('active'));
        a.classList.add('active');
      }
    });
    li.appendChild(a);
    navFrag.appendChild(li);
    
    if (art.headers && art.headers.length > 0) {
      art.headers.forEach(header => {
        if (header === '[ILP-PARA]') return;
        const displayH = ILP.parser.unwrapTitleMarker(header);
        if (ILP.parser.isStructuralHeader(displayH)) {
          const headerDiv = document.createElement('div');
          headerDiv.className = 'cba-structural-header';
          if (filterQuery) headerDiv.innerHTML = highlightText(displayH, filterQuery);
          else headerDiv.textContent = displayH;
          if (!isMatch) headerDiv.style.display = 'none';
          containerFrag.appendChild(headerDiv);
        }
      });
    }
    
    const section = document.createElement('section');
    section.id = artId;
    section.className = 'law-article';
    if (!isMatch) section.style.display = 'none';
    
    if (art.headers && art.headers.length > 0) {
      art.headers.forEach(header => {
        if (header === '[ILP-PARA]') return;
        const displayH = ILP.parser.unwrapTitleMarker(header);
        if (!ILP.parser.isStructuralHeader(displayH)) {
          const subtitleDiv = document.createElement('div');
          subtitleDiv.className = 'cba-article-subtitle';
          if (filterQuery) subtitleDiv.innerHTML = highlightText(displayH, filterQuery);
          else subtitleDiv.textContent = displayH;
          section.appendChild(subtitleDiv);
        }
      });
    }
    
    const header = document.createElement('div');
    header.className = 'law-article-header';
    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    if (filterQuery) h3.innerHTML = highlightText(art.prefix, filterQuery);
    else h3.textContent = art.prefix;
    header.appendChild(h3);
    
    const copyArtBtn = document.createElement('button');
    copyArtBtn.className = 'cba-art-action-btn';
    copyArtBtn.title = 'Copiar artículo';
    copyArtBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875M9 7.875c0-.621.504-1.125 1.125-1.125H18a1.125 1.125 0 011.125 1.125V15c0 .621-.504 1.125-1.125 1.125H10.125A1.125 1.125 0 019 15V7.875z" /></svg>`;
    header.appendChild(copyArtBtn);
    section.appendChild(header);
    
    const bodyP = document.createElement('p');
    bodyP.className = 'law-article-body';
    bodyP.innerHTML = formatArticleBodyHtml(art.text, filterQuery);
    section.appendChild(bodyP);
    
    containerFrag.appendChild(section);
  });
  
  if (parsedLawData.footer) {
    const footerDiv = document.createElement('div');
    footerDiv.className = 'cba-footer-sig';
    parsedLawData.footer.split('\n\n').forEach(para => {
      const p = document.createElement('p');
      if (filterQuery) p.innerHTML = highlightText(para, filterQuery);
      else p.textContent = para;
      footerDiv.appendChild(p);
    });
    containerFrag.appendChild(footerDiv);
  }
  
  container.appendChild(containerFrag);
  navList.appendChild(navFrag);
}

function initScrollSpy() {
  const contentWrapper = document.getElementById('cba-content-wrapper');
  const navList = document.getElementById('cba-nav-list');
  if (!contentWrapper || !navList) return;
  
  let isScrolling = false;
  contentWrapper.addEventListener('scroll', () => {
    if (!isScrolling) {
      window.requestAnimationFrame(() => {
        const scrollTop = contentWrapper.scrollTop;
        const scrollHeight = contentWrapper.scrollHeight - contentWrapper.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        const progressBar = document.getElementById('cba-progress-bar');
        if (progressBar) progressBar.style.width = `${progress}%`;
        
        const backToTopBtn = document.getElementById('cba-back-to-top');
        if (backToTopBtn) backToTopBtn.classList.toggle('visible', scrollTop > 300);
        isScrolling = false;
      });
      isScrolling = true;
    }
  });
  
  const navLinks = Array.from(document.querySelectorAll('.cba-nav-link'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const activeId = entry.target.id;
        navLinks.forEach(link => {
          const isActive = link.dataset.target === activeId;
          link.classList.toggle('active', isActive);
          if (isActive) {
            const linkRect = link.getBoundingClientRect();
            const sidebarRect = navList.getBoundingClientRect();
            if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
              link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        });
      }
    });
  }, { root: contentWrapper, rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  document.querySelectorAll('.law-article').forEach(art => observer.observe(art));
}

function applySettings() {
  const readerRoot = document.getElementById('cba-reader-root');
  if (readerRoot) {
    readerRoot.setAttribute('data-theme', settings.theme);
    readerRoot.setAttribute('data-font', settings.fontFamily);
  }
  const portalRoot = document.getElementById('cba-portal-root');
  if (portalRoot) {
    portalRoot.setAttribute('data-theme', settings.theme);
  }
  
  const content = document.getElementById('cba-content-wrapper');
  if (content) content.style.fontSize = `${settings.fontSize}%`;
  
  document.querySelectorAll('.cba-theme-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.theme === settings.theme);
  });
  
  const fontFamBtn = document.getElementById('cba-font-family');
  if (fontFamBtn) fontFamBtn.classList.toggle('active', settings.fontFamily === 'sans');
}

function copyToClipboardFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);
  
  // Save current selection
  const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : null;
  
  textarea.focus();
  textarea.select();
  
  const onCopy = (e) => {
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  };
  document.addEventListener('copy', onCopy);
  
  try {
    const successful = document.execCommand('copy');
    document.removeEventListener('copy', onCopy);
    document.body.removeChild(textarea);
    
    // Restore selection
    if (selected) {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(selected);
    }
    
    if (successful) {
      return Promise.resolve();
    } else {
      return Promise.reject(new Error('execCommand copy returned false'));
    }
  } catch (err) {
    document.removeEventListener('copy', onCopy);
    document.body.removeChild(textarea);
    if (selected) {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(selected);
    }
    return Promise.reject(err);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(err => {
      console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
      return copyToClipboardFallback(text);
    });
  } else {
    return copyToClipboardFallback(text);
  }
}

function copyFullText() {
  const strip = (ILP.parser && ILP.parser.stripMarkers) || ((t) => t);
  let output = `${parsedLawData.title}\n\n`;
  if (parsedLawData.preamble) output += `${strip(parsedLawData.preamble)}\n\n`;
  parsedLawData.articles.forEach(art => {
    if (art.headers && art.headers.length > 0) {
      output += art.headers.map(h => strip(h)).filter(Boolean).join('\n') + '\n';
    }
    output += `${strip(art.prefix)}\n${strip(art.text)}\n\n`;
  });
  if (parsedLawData.footer) output += `${strip(parsedLawData.footer)}\n`;
  
  copyToClipboard(output).then(() => {
    const copyBtn = document.getElementById('cba-action-copy');
    if (copyBtn) {
      const oldHtml = copyBtn.innerHTML;
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => copyBtn.innerHTML = oldHtml, 1200);
    }
  }).catch(err => console.error('Clipboard copy failed:', err));
}

function printLaw() {
  const printBtn = document.getElementById('cba-action-print');
  try {
    // Cerrar dropdowns antes de imprimir para preview limpio.
    // (El @media print CSS ya oculta el resto de la UI, pero removiendo
    //  .show garantizamos que la pantalla vuelva normal al cancelar.)
    document.querySelectorAll('.cba-dropdown-menu.show').forEach((m) => m.classList.remove('show'));

    if (window.parent && window.parent !== window) {
      try {
        window.parent.focus();
      } catch (e) { /* cross-origin parent, ignore */ }
    }
    window.focus();
    const result = window.print();
    if (result === false && printBtn) {
      console.warn('window.print() devolvió false (posible bloqueo del navegador)');
    }
  } catch (err) {
    console.error('print failed:', err);
    if (printBtn) {
      printBtn.textContent = 'Error al imprimir';
      setTimeout(() => {
        printBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.82l.024-.03a.75.75 0 111.12 1zM16.5 12V6M5.25 6h13.5A2.25 2.25 0 0121 8.25v7.5A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75v-7.5A2.25 2.25 0 015.25 6zM6 18H18v3.375c0 .621-.504 1.125-1.125 1.125H7.125A1.125 1.125 0 016 21.375V18z" /></svg>Imprimir`;
      }, 1800);
    }
    alert('No se pudo abrir el diálogo de impresión. Probá cargando la página directamente (no en iframe).');
  }
}

function exportToPdfDirect() {
  const exportBtn = document.getElementById('cba-action-pdf-direct');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Generando PDF...';
  }

  chrome.runtime.sendMessage({ action: 'exportPDF', lawData: parsedLawData }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('runtime.lastError:', chrome.runtime.lastError.message);
    }
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 011.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>Descargar PDF`;
    }

    if (response && response.success && response.dataUri) {
      const a = document.createElement('a');
      a.href = response.dataUri;
      a.download = `${parsedLawData.title.replace(/[\/\\?%*:|"<>]/g, '_')}.pdf`;
      a.click();
    } else {
      const errMsg = response ? response.error : (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Respuesta nula');
      console.error('Error generando PDF:', errMsg);
      alert('Error al exportar a PDF: ' + errMsg);
    }
  });
}

function exportToDocx() {
  const exportBtn = document.getElementById('cba-action-docx');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Generando Word...';
  }

  chrome.runtime.sendMessage({ action: 'exportDOCX', lawData: parsedLawData }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('runtime.lastError:', chrome.runtime.lastError.message);
    }
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 011.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 10.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 18.75h-6.75A2.25 2.25 0 013 16.5v-12.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25V7.5" /></svg>Descargar Docx`;
    }

    if (response && response.success && response.base64) {
      const a = document.createElement('a');
      a.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${response.base64}`;
      a.download = `${parsedLawData.title.replace(/[\/\\?%*:|"<>]/g, '_')}.docx`;
      a.click();
    } else {
      const errMsg = response ? response.error : (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Respuesta nula');
      console.error('Error generando Word:', errMsg);
      alert('Error al exportar a Word: ' + errMsg);
    }
  });
}

function formatTextToMarkdown(text) {
  if (!text) return '';
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    const listMatch = trimmed.match(/^([a-z0-9I|V|X]+[\)\.\-]{1,2})\s+(.*)/i);
    return listMatch ? `* **${listMatch[1]}** ${listMatch[2]}` : trimmed;
  }).filter(l => l.length > 0).join('\n\n');
}

function exportToMarkdown() {
  let md = `# ${parsedLawData.title}\n\n`;
  if (parsedLawData.preamble) {
    md += `## Preámbulo\n\n`;
    parsedLawData.preamble.split('\n\n').forEach(para => {
      if (para.trim()) md += `> ${para.trim().replace(/\n/g, '\n> ')}\n\n`;
    });
  }
  if (parsedLawData.articles && parsedLawData.articles.length > 0) {
    md += `## Articulado\n\n`;
    parsedLawData.articles.forEach(art => {
      if (art.headers && art.headers.length > 0) {
        art.headers.forEach(header => {
          md += ILP.parser.isStructuralHeader(header) ? `## ${header.trim()}\n\n` : `*${header.trim()}*\n\n`;
        });
      }
      md += `### ${art.prefix.trim()}\n\n${formatTextToMarkdown(art.text)}\n\n`;
    });
  }
  if (parsedLawData.footer) {
    md += `---\n\n### Firmantes / Pie de Norma\n\n`;
    parsedLawData.footer.split('\n\n').forEach(para => {
      if (para.trim()) md += `*${para.trim()}*\n\n`;
    });
  }
  
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${parsedLawData.title.replace(/[\/\\?%*:|"<>]/g, '_')}.md`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function clearSearchHighlights(container) {
  Array.from(container.querySelectorAll('mark.cba-text-match')).forEach(mark => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function highlightCurrentMatch() {
  textMatches.forEach(match => match.classList.remove('cba-current-match'));
  if (currentMatchIndex >= 0 && currentMatchIndex < textMatches.length) {
    const activeMatch = textMatches[currentMatchIndex];
    activeMatch.classList.add('cba-current-match');
    activeMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('cba-search-count').textContent = `${currentMatchIndex + 1} de ${textMatches.length}`;
  } else {
    document.getElementById('cba-search-count').textContent = `0 de ${textMatches.length}`;
  }
}

function performTextSearch(query) {
  const container = document.getElementById('cba-reader-body-content');
  if (!container) return;
  
  clearSearchHighlights(container);
  textMatches = [];
  currentMatchIndex = -1;
  
  if (!query || query.trim().length < 2) {
    document.getElementById('cba-search-count').textContent = '0 de 0';
    return;
  }
  
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      if (node.parentNode.classList.contains('cba-art-action-btn')) return NodeFilter.FILTER_REJECT;
      if (node.parentNode.tagName === 'MARK') return NodeFilter.FILTER_REJECT;
      return regex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodesToReplace = [];
  let currentNode;
  while (currentNode = walker.nextNode()) nodesToReplace.push(currentNode);

  nodesToReplace.forEach(node => {
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    node.nodeValue.replace(regex, (match, p1, offset) => {
      frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIdx, offset)));
      const mark = document.createElement('mark');
      mark.className = 'cba-text-match';
      mark.textContent = match;
      frag.appendChild(mark);
      lastIdx = offset + match.length;
    });
    frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIdx)));
    node.parentNode.replaceChild(frag, node);
  });
  
  textMatches = Array.from(container.querySelectorAll('mark.cba-text-match'));
  
  if (textMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch();
  } else {
    document.getElementById('cba-search-count').textContent = '0 de 0';
  }
}

function toggleDropdown(menuId) {
  const menu = document.getElementById(menuId);
  if (menu) menu.classList.toggle('show');
}

function setupEventDelegationForCopy() {
  const container = document.getElementById('cba-reader-body-content');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.cba-art-action-btn');
    if (copyBtn) {
      const section = copyBtn.closest('.law-article');
      if (section) {
        const subtitleEl = section.querySelector('.cba-article-subtitle');
        const subtitleText = subtitleEl ? subtitleEl.innerText + '\n' : '';
        const h3Text = section.querySelector('h3').innerText;
        const bodyText = section.querySelector('.law-article-body').innerText;
        copyToClipboard(`${subtitleText}${h3Text}\n${bodyText}`).then(() => {
          const oldHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 14px; height: 14px; color: #10b981;"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>`;
          setTimeout(() => copyBtn.innerHTML = oldHtml, 1200);
        }).catch(err => console.error('Clipboard copy failed:', err));
      }
    }
  });
}

function makeElementResizable(handle, target, direction, minWidth, maxWidth, isRightSidebar = false) {
  let startX, startWidth;
  function startDrag(e) {
    e.preventDefault();
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(target).width, 10);
    handle.classList.add('cba-splitter-active');
    document.addEventListener('mousemove', doDrag, false);
    document.addEventListener('mouseup', stopDrag, false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }
  function doDrag(e) {
    let newWidth = isRightSidebar ? startWidth - (e.clientX - startX) : startWidth + (e.clientX - startX);
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    target.style.width = `${newWidth}px`;
    target.style.flexBasis = `${newWidth}px`;
  }
  function stopDrag() {
    handle.classList.remove('cba-splitter-active');
    document.removeEventListener('mousemove', doDrag, false);
    document.removeEventListener('mouseup', stopDrag, false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (!target.classList.contains('collapsed')) {
      localStorage.setItem(isRightSidebar ? 'cba-sidebar-width' : 'cba-portal-left-width', target.style.width);
    }
  }
  handle.addEventListener('mousedown', startDrag, false);
}

function setupSplitterResizing() {
  // Right sidebar resizer (TOC)
  const sidebarSplitter = document.getElementById('cba-sidebar-splitter');
  const sidebar = document.getElementById('cba-sidebar');
  if (sidebarSplitter && sidebar) {
    const savedWidth = localStorage.getItem('cba-sidebar-width');
    if (savedWidth && !sidebar.classList.contains('collapsed')) {
      sidebar.style.width = savedWidth;
      sidebar.style.flexBasis = savedWidth;
    }
    makeElementResizable(sidebarSplitter, sidebar, 'horizontal', 140, 400, true);
  }

  // Left portal resizer (Buscador)
  const portalSplitter = document.getElementById('cba-portal-splitter');
  const leftPane = document.querySelector('.cba-portal-left-pane');
  if (portalSplitter && leftPane) {
    const savedWidth = localStorage.getItem('cba-portal-left-width');
    if (savedWidth) {
      leftPane.style.width = savedWidth;
      leftPane.style.flexBasis = savedWidth;
    }
    makeElementResizable(portalSplitter, leftPane, 'horizontal', 240, 600, false);
  }
}

/**
 * Normalizes relative URLs parsed from Lotus Domino links.
 */
function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  let cleanUrl = url.trim();
  while (cleanUrl.startsWith('.') || cleanUrl.startsWith('/')) {
    cleanUrl = cleanUrl.substring(1);
  }
  const isRealSite = window.location.hostname.includes('cba.gov.ar');
  const base = isRealSite ? window.location.origin : 'http://web2.cba.gov.ar';
  if (cleanUrl.startsWith('web/leyes.nsf/')) {
    return base + '/' + cleanUrl;
  }
  return base + '/web/leyes.nsf/' + cleanUrl;
}

function ensureFloatingReturnButton() {
  let floatingReturn = document.getElementById('cba-floating-return-btn');
  if (!floatingReturn) {
    floatingReturn = document.createElement('button');
    floatingReturn.id = 'cba-floating-return-btn';
    floatingReturn.className = 'cba-toggle-view-btn';
    floatingReturn.style.display = 'none'; // Hidden by default (since portal is active)
    floatingReturn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 4px; display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
      <span style="vertical-align: middle;">Volver a la Extensión</span>
    `;
    document.body.appendChild(floatingReturn);
    
    floatingReturn.addEventListener('click', () => {
      document.body.classList.add('cba-portal-active');
      const portalRoot = document.getElementById('cba-portal-root');
      if (portalRoot) portalRoot.style.display = 'flex';
      floatingReturn.style.display = 'none';
    });
  }
  return floatingReturn;
}

/**
 * Creates and injects the unified 2-column legal search dashboard SPA layout.
 */
function createPortalUi() {
  if (document.getElementById('cba-portal-root')) return;

  const portalRoot = document.createElement('div');
  portalRoot.id = 'cba-portal-root';
  
  portalRoot.innerHTML = `
    <!-- Column 1: Left Search & Results Pane -->
    <aside class="cba-portal-left-pane">
      <div class="cba-portal-logo" style="padding: 24px 24px 12px 24px; margin-bottom: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v14.25" />
        </svg>
        Leyes de Córdoba
      </div>

      <!-- Tab Switcher -->
      <div class="cba-sidebar-tabs">
        <button id="cba-tab-btn-search" class="cba-tab-btn active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>Búsqueda</span>
        </button>
        <button id="cba-tab-btn-library" class="cba-tab-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6 2v15H4V2z"/><path d="M10 2v15H8V2z"/><path d="M14 2v15h-2V2z"/></svg>
          <span>Biblioteca</span>
        </button>
      </div>

      <!-- Panel 1: Búsqueda -->
      <div id="cba-panel-search" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; height: 100%;">
        <!-- Search fields directly embedded -->
        <div class="cba-search-form-container">
          <div class="cba-form-group">
            <label class="cba-form-label" for="cba-param-bs">Palabras clave / Búsqueda</label>
            <input type="text" id="cba-param-bs" class="cba-portal-input" placeholder="Ej. indemnización, daños..." />
          </div>
          
          <div class="cba-form-group-row" style="display: flex; gap: 8px; margin-bottom: 0;">
            <div class="cba-form-group" style="flex: 1; margin-bottom: 0;">
              <label class="cba-form-label" for="cba-param-nu">Número</label>
              <input type="text" id="cba-param-nu" class="cba-portal-input" placeholder="Ej. 8465" />
            </div>
            
            <div class="cba-form-group" style="flex: 1; margin-bottom: 0;">
              <label class="cba-form-label" for="cba-param-an">Año</label>
              <input type="text" id="cba-param-an" class="cba-portal-input" placeholder="Ej. 1984" />
            </div>
          </div>
          
          <div class="cba-form-group-row" style="display: flex; gap: 8px; align-items: flex-end; margin-bottom: 0; margin-top: 10px;">
            <div class="cba-form-group" style="flex: 1; margin-bottom: 0;">
              <label class="cba-form-label" for="cba-param-ori">Tipo de Norma</label>
              <select id="cba-param-ori" class="cba-portal-input" style="height: 35px; padding: 4px 10px;">
                <option value="L">Leyes</option>
                <option value="D">Decretos</option>
                <option value="">Todas</option>
              </select>
            </div>
            
            <button id="cba-search-btn" class="cba-submit-btn" style="margin-top: 0; height: 35px; flex: 1;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
              </svg>
              Buscar
            </button>
          </div>
          
          <div class="cba-quick-links" style="margin-top: 12px; display: flex; justify-content: flex-start;">
            <button id="cba-btn-const" class="cba-submit-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-primary); box-shadow: none; margin-top: 0; padding: 6px 12px; font-size: 0.8rem; width: auto;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 14px; height: 14px; color: var(--accent);">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v14.25" />
              </svg>
              Constitución de Córdoba
            </button>
          </div>
        </div>

        <div class="cba-portal-results-wrapper" style="flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; min-height: 120px;">
          <h4 class="cba-results-count-title" id="cba-results-count">Resultados</h4>
          <div class="cba-results-list" id="cba-portal-results">
            <!-- Dynamically filled -->
          </div>
        </div>

        <!-- Normas Recientes Panel -->
        <div class="cba-recent-laws-panel" style="padding: 12px 24px; display: flex; flex-direction: column; flex-shrink: 0; border-top: 1px solid var(--border); height: 35%; min-height: 140px; overflow: hidden;">
          <h4 style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px; color: var(--accent);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Normas Recientes
          </h4>
          <div id="cba-recent-list" class="cba-results-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          </div>
        </div>
      </div>

      <!-- Panel 2: Biblioteca -->
      <div id="cba-panel-library" style="flex: 1; display: none; flex-direction: column; overflow-y: auto; height: 100%;">
        <!-- Normas Frecuentes de Córdoba Panel (Renamed to Normas Destacadas) -->
        <div class="cba-freq-laws-panel" style="padding: 12px 24px; display: flex; flex-direction: column; flex-shrink: 0;">
          <h4 style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 13px; height: 13px; color: var(--accent);"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Normas Destacadas
          </h4>
          <div class="cba-freq-category-wrapper" style="margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
            <label for="cba-frequent-category-select" style="font-size: 0.65rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em;">Categoría</label>
            <select id="cba-frequent-category-select" class="cba-portal-input" style="padding: 6px 10px; font-size: 0.78rem; outline: none; width: 100%;">
            </select>
          </div>
          <div id="cba-frequent-list" class="cba-results-list" style="display: flex; flex-direction: column; gap: 8px;">
          </div>
        </div>
      </div>
      
      <!-- Bottom Theme & Toggle Panel -->
      <footer class="cba-portal-left-footer">
        <button id="cba-sidebar-toggle-original-btn" class="cba-submit-btn">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 14px; height: 14px; color: var(--accent); margin-right: 4px; display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span style="vertical-align: middle;">Ver Original</span>
        </button>
        <div class="cba-theme-selector-pill">
          <div class="cba-theme-dot cba-theme-light-dot cba-tooltip" data-theme="light" data-tooltip="Tema Claro"></div>
          <div class="cba-theme-dot cba-theme-sepia-dot cba-tooltip" data-theme="sepia" data-tooltip="Tema Sepia"></div>
          <div class="cba-theme-dot cba-theme-dark-dot cba-tooltip" data-theme="dark" data-tooltip="Tema Oscuro"></div>
        </div>
      </footer>
    </aside>
    
    <!-- Portal Splitter -->
    <div class="cba-portal-splitter" id="cba-portal-splitter"></div>
    
    <!-- Column 2: Right Viewer Pane -->
    <main class="cba-portal-main-view" id="cba-portal-viewer-container">
      <div class="cba-main-placeholder" id="cba-portal-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.25" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v14.25" />
        </svg>
        <h3 style="font-weight: 700; margin: 16px 0 8px 0; font-size: 1.1rem; color: var(--text-primary);">Portal de Leyes de Córdoba</h3>
        <p style="font-size: 0.85rem; margin: 0; max-width: 280px; line-height: 1.5;">Selecciona una norma del panel de la izquierda para comenzar a leer.</p>
      </div>
    </main>
  `;
  
  document.body.appendChild(portalRoot);
  
  // Setup event listeners for search
  document.getElementById('cba-search-btn').addEventListener('click', () => {
    const bs = document.getElementById('cba-param-bs').value;
    const nu = document.getElementById('cba-param-nu').value;
    const an = document.getElementById('cba-param-an').value;
    const ori = document.getElementById('cba-param-ori').value;
    performSearch(bs, nu, an, ori);
  });
  
  // Make inputs trigger search on Enter
  ['cba-param-bs', 'cba-param-nu', 'cba-param-an'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('cba-search-btn').click();
      }
    });
  });

  // Setup Constitution Link
  document.getElementById('cba-btn-const').addEventListener('click', () => {
    portalRoot.querySelectorAll('.cba-result-card').forEach(c => c.classList.remove('active'));
    loadedLawId = 'CP00';
    renderFrequentLaws();
    renderRecentLaws();
    loadLawInViewer('CP00', 'L', 'Constitución de la Provincia de Córdoba');
  });

  // Setup frequent laws category select & list population
  const selectEl = portalRoot.querySelector('#cba-frequent-category-select');
  if (selectEl) {
    Object.keys(FREQUENT_LAWS).forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      selectEl.appendChild(option);
    });
    
    selectEl.addEventListener('change', () => {
      renderFrequentLaws();
    });
  }

  // Setup Tab Switcher
  const tabSearch = portalRoot.querySelector('#cba-tab-btn-search');
  const tabLibrary = portalRoot.querySelector('#cba-tab-btn-library');
  const panelSearch = portalRoot.querySelector('#cba-panel-search');
  const panelLibrary = portalRoot.querySelector('#cba-panel-library');

  if (tabSearch && tabLibrary && panelSearch && panelLibrary) {
    tabSearch.addEventListener('click', () => {
      tabSearch.classList.add('active');
      tabLibrary.classList.remove('active');
      panelSearch.style.display = 'flex';
      panelLibrary.style.display = 'none';
    });

    tabLibrary.addEventListener('click', () => {
      tabLibrary.classList.add('active');
      tabSearch.classList.remove('active');
      panelSearch.style.display = 'none';
      panelLibrary.style.display = 'flex';
      renderRecentLaws();
    });
  }

  // Initial render of frequent laws & recent laws
  setTimeout(() => {
    renderFrequentLaws();
    renderRecentLaws();
  }, 0);

  // Setup theme dot buttons
  portalRoot.querySelectorAll('.cba-theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      settings.theme = dot.dataset.theme;
      localStorage.setItem('cba-reader-theme', settings.theme);
      applySettings();
    });
  });

  // Setup Ver Original toggle button
  const toggleOrgBtn = document.getElementById('cba-sidebar-toggle-original-btn');
  if (toggleOrgBtn) {
    toggleOrgBtn.addEventListener('click', () => {
      document.body.classList.remove('cba-portal-active');
      document.getElementById('cba-portal-root').style.display = 'none';
      const floatingReturn = ensureFloatingReturnButton();
      if (floatingReturn) floatingReturn.style.display = 'flex';
    });
  }

  // Init Splitters for portal layout
  setupSplitterResizing();
}

/**
 * Scrapes any initial results from the original Lotus Domino HTML tables.
 */
function scrapeDOMResults() {
  const results = [];
  const seenIds = new Set();
  const anchors = Array.from(document.querySelectorAll('a[href*="OpenDocument"]'));
  
  anchors.forEach(a => {
    const href = a.getAttribute('href');
    const idMatch = href.match(/\/([0-9a-f]{16,64})\?OpenDocument/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;
    seenIds.add(id);
    
    const tr = a.closest('tr');
    if (!tr) {
      const text = a.textContent.trim();
      const numMatch = text.match(/Ley\s*N°?\s*(\d+)/i) || text.match(/(\d+)/);
      results.push({
        id,
        ori: href.includes('e2911dff3722eec50325724a006a2da0') ? 'D' : 'L',
        tipo: href.includes('e2911dff3722eec50325724a006a2da0') ? 'Decreto' : 'Ley',
        numero: numMatch ? numMatch[1] : '',
        titulo: text || `Norma ${id}`
      });
      return;
    }
    
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 4) return;
    
    const tipoText = cells[1].textContent.trim();
    const numeroText = cells[2].textContent.trim();
    const tituloText = cells[3].textContent.trim();
    
    const numero = numeroText.match(/(\d+)/)?.[1] ?? numeroText;
    let anio;
    const year4 = `${numeroText} ${tituloText}`.match(/((?:19|20)\d{2})/);
    if (year4) anio = Number(year4[1]);
    
    results.push({
      id,
      ori: /decreto/i.test(tipoText) ? 'D' : 'L',
      tipo: tipoText || 'Ley',
      numero,
      anio,
      titulo: tituloText || `${tipoText} ${numero}`
    });
  });
  
  return results;
}

/**
 * Renders the results array to the sidebar list container.
 */
function renderResultsList(results) {
  const container = document.getElementById('cba-portal-results');
  const countEl = document.getElementById('cba-results-count');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="cba-results-placeholder">
        No se encontraron normas.<br>
        Prueba ajustando los términos de búsqueda.
      </div>
    `;
    if (countEl) countEl.textContent = '0 resultados';
    return;
  }
  
  if (countEl) countEl.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;
  
  const frag = document.createDocumentFragment();
  results.forEach(r => {
    const card = document.createElement('div');
    card.className = 'cba-result-card';
    card.dataset.id = r.id;
    card.dataset.ori = r.ori;
    
    const metaHtml = [
      r.anio ? `<span class="cba-meta-item">📅 ${r.anio}</span>` : null,
      `<span class="cba-meta-item">${r.tipo}</span>`
    ].filter(Boolean).join('');
    
    card.innerHTML = `
      <div class="cba-result-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; width: 100%;">
        <span style="font-size: 0.7rem; font-weight: 700; color: var(--accent); text-transform: uppercase;">N° ${r.numero}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="cba-result-card-meta" style="margin-bottom: 0;">${metaHtml}</div>
          <button class="cba-new-tab-btn" title="Abrir en nueva pestaña">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        </div>
      </div>
      <h5 class="cba-result-card-title">${r.titulo}</h5>
    `;
    
    const newTabBtn = card.querySelector('.cba-new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const viewPath = (r.id === 'CP00') ? '6dd74b426f288a67032572340058a003' : (r.ori === '0' || r.id.length === 32 ? '0' : (r.ori === 'D' ? 'e2911dff3722eec50325724a006a2da0' : '6dd74b426f288a67032572340058a003'));
        const rawUrl = `/web/leyes.nsf/${viewPath}/${r.id}?OpenDocument`;
        window.open(normalizeUrl(rawUrl), '_blank');
      });
    }
    
    card.addEventListener('click', () => {
      document.querySelectorAll('.cba-result-card').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.cba-freq-law-btn').forEach(b => b.classList.remove('active'));
      card.classList.add('active');
      loadLawInViewer(r.id, r.ori, r.titulo);
    });
    
    frag.appendChild(card);
  });
  
  container.appendChild(frag);
}

/**
 * Performs search fetch dynamically, parsing Domino results table with DOMParser.
 */
async function performSearch(texto, numero, anio, ori) {
  const params = new URLSearchParams();
  params.set('OpenForm', '');
  params.set('BS', 'S');
  params.set('ORI', ori);
  if (numero) params.set('NU', numero);
  if (anio) params.set('AN', String(anio));
  params.set('CP', 'S');
  params.set('PA', '');
  params.set('CT', 'S');
  params.set('TI', texto);
  params.set('VI', 'S');
  
  const url = `/web/leyes.nsf/frb?${params.toString()}`;
  const list = document.getElementById('cba-portal-results');
  const countEl = document.getElementById('cba-results-count');
  
  if (list) {
    list.innerHTML = '<div style="padding:32px; text-align:center;"><div class="cba-loader" style="margin: 0 auto;"></div></div>';
  }
  if (countEl) countEl.textContent = 'Buscando...';
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const html = new TextDecoder('windows-1252').decode(buffer);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href*="OpenDocument"]'));
    const results = [];
    const seen = new Set();
    
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      const idMatch = href.match(/\/([0-9a-f]{16,64})\?OpenDocument/i);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);
      
      const tr = a.closest('tr');
      if (!tr) return;
      const cells = Array.from(tr.querySelectorAll('td'));
      if (cells.length < 4) return;
      
      const tipoText = cells[1].textContent.trim();
      const numeroText = cells[2].textContent.trim();
      const tituloText = cells[3].textContent.trim();
      
      const numero = numeroText.match(/(\d+)/)?.[1] ?? numeroText;
      let anioResult;
      const year4 = `${numeroText} ${tituloText}`.match(/((?:19|20)\d{2})/);
      if (year4) anioResult = Number(year4[1]);
      
      results.push({
        id,
        ori: /decreto/i.test(tipoText) ? 'D' : 'L',
        tipo: tipoText || 'Ley',
        numero,
        anio: anioResult,
        titulo: tituloText || `${tipoText} ${numero}`
      });
    });
    
    renderResultsList(results);
  } catch (err) {
    console.error("AJAX Search failed:", err);
    if (list) {
      list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--accent); font-weight: 500;">Error al buscar: ${err.message}</div>`;
    }
    if (countEl) countEl.textContent = 'Error';
  }
}

function injectReaderInContainer(container) {
  const existingReader = document.getElementById('cba-reader-root');
  if (existingReader) existingReader.remove();
  
  const readerRoot = document.createElement('div');
  readerRoot.id = 'cba-reader-root';
  readerRoot.innerHTML = `
    <div class="cba-progress-container"><div class="cba-progress-bar" id="cba-progress-bar"></div></div>
    <main class="cba-content-wrapper" id="cba-content-wrapper">
      <div class="cba-reader-sticky-header" id="cba-reader-sticky-header">
        <div class="cba-in-text-search-bar" id="cba-in-text-search-bar">
          <div style="position: relative; flex: 1;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--text-secondary); pointer-events: none;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" /></svg>
            <input type="text" id="cba-in-text-search" class="cba-in-text-input" placeholder="Buscar en esta ley..." />
          </div>
          <div class="cba-search-controls">
            <span class="cba-search-count" id="cba-search-count">0 de 0</span>
            <button class="cba-search-arrow-btn" id="cba-search-prev" title="Anterior"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7" /></svg></button>
            <button class="cba-search-arrow-btn" id="cba-search-next" title="Siguiente"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
          </div>
        </div>
      </div>
      
      <div class="cba-reader-main-area">
        <div class="cba-reader-scroll-area">
          <div class="cba-content-inner">
            <header class="cba-law-header">
              <h1 class="cba-law-title" id="cba-law-title-text">Cargando Ley...</h1>
              <div class="cba-meta-badge" id="cba-meta-badge">Leyes de Córdoba</div>
            </header>
            <div class="cba-reader-body" id="cba-reader-body-content"></div>
          </div>
          <div class="cba-stats-bar">
            <div class="cba-stats-left">
              <span id="cba-stat-words">0 palabras</span>
              <span id="cba-stat-time">0 min de lectura</span>
            </div>
          </div>
          <button class="cba-back-to-top" id="cba-back-to-top" title="Volver al inicio"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg></button>
        </div>
        <div class="cba-action-toolbar-vertical">
          <button class="cba-btn cba-tooltip" id="cba-font-dec" data-tooltip="Reducir letra">A-</button>
          <button class="cba-btn cba-tooltip" id="cba-font-inc" data-tooltip="Aumentar letra">A+</button>
          <button class="cba-btn cba-tooltip" id="cba-font-family" data-tooltip="Cambiar letra"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7.5L12 4.5m0 0l3 3M12 4.5M12 19.5l3-3m-3 3l-3-3M12 19.5M4.5 12l3-3m-3 3l3 3m-3-3h15" /></svg></button>
          <button class="cba-btn cba-tooltip" id="cba-sidebar-toggle-btn" data-tooltip="Alternar Índice"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4.5v15m6-15v15m-12-3h18c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z" /></svg></button>
          <button class="cba-btn cba-tooltip" id="cba-action-copy" data-tooltip="Copiar Texto Completo"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875M9 7.875c0-.621.504-1.125 1.125-1.125H18a1.125 1.125 0 011.125 1.125V15c0 .621-.504 1.125-1.125 1.125H10.125A1.125 1.125 0 019 15V7.875z" /></svg></button>
          <div class="cba-dropdown-container">
            <button class="cba-btn cba-tooltip" id="cba-download-dropdown-btn" data-tooltip="Descargar Norma"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg></button>
            <div class="cba-dropdown-menu" id="cba-download-menu">
              <button class="cba-dropdown-item" id="cba-action-pdf-direct"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 011.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>Descargar PDF</button>
              <button class="cba-dropdown-item" id="cba-action-docx"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 11-1.5 0 .75.75 0 011.5 0zM12 18.75h-6.75A2.25 2.25 0 013 16.5v-12.75a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25V7.5" /></svg>Descargar Docx</button>
              <button class="cba-dropdown-item" id="cba-action-md"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM9 11.25h6m-6 3h6m-6 3h6" /></svg>Descargar Markdown (.md)</button>
              <button class="cba-dropdown-item" id="cba-action-print"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.82l.024-.03a.75.75 0 111.12 1zM16.5 12V6M5.25 6h13.5A2.25 2.25 0 0121 8.25v7.5A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75v-7.5A2.25 2.25 0 015.25 6zM6 18H18v3.375c0 .621-.504 1.125-1.125 1.125H7.125A1.125 1.125 0 016 21.375V18z" /></svg>Imprimir</button>
            </div>
          </div>
        </div>
      </div>
    </main>
    <div class="cba-sidebar-splitter" id="cba-sidebar-splitter"></div>
    <aside class="cba-sidebar" id="cba-sidebar">
      <div class="cba-sidebar-header">
        <h2 class="cba-sidebar-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v14.25" /></svg>Índice de Artículos</h2>
        <div class="cba-search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" /></svg>
          <input type="text" id="cba-search" class="cba-search-input" placeholder="Buscar en artículos..." />
        </div>
      </div>
      <ul class="cba-nav-list" id="cba-nav-list"></ul>
    </aside>
  `;
  container.appendChild(readerRoot);
}

async function displayLawInReader(rawText, title) {
  parsedLawData = rawText.length < 90000
    ? ILP.parser.parseLawText(rawText)
    : await ILP.parser.parseLawTextAsync(rawText);

  let currentTitle = title || parsedLawData.title || '';
  currentTitle = currentTitle.trim();
  
  const parsedMeta = parseNormTypeAndNumber(rawText);
  if (parsedMeta) {
    const hasType = new RegExp(parsedMeta.tipo, 'i').test(currentTitle);
    const hasNumber = new RegExp(parsedMeta.numero.replace(/\./g, '\\.'), 'i').test(currentTitle);
    
    if (!(hasType && hasNumber)) {
      if (!currentTitle || currentTitle.toLowerCase() === 'norma' || currentTitle.toLowerCase() === 'normativa de córdoba') {
        currentTitle = `${parsedMeta.tipo} N° ${parsedMeta.numero}`;
      } else {
        currentTitle = `${parsedMeta.tipo} N° ${parsedMeta.numero} - ${currentTitle}`;
      }
    }
  }
  
  parsedLawData.title = currentTitle;
  
  document.getElementById('cba-law-title-text').textContent = parsedLawData.title;
  const wordsCount = rawText.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.round(wordsCount / 225));
  document.getElementById('cba-stat-words').textContent = `${wordsCount.toLocaleString()} palabras`;
  document.getElementById('cba-stat-time').textContent = `${readingTime} min de lectura`;
  
  if (parsedLawData.articles.length > 200) {
    await renderArticlesChunked();
  } else {
    renderArticles();
  }
  
  initScrollSpy();
  applySettings();

  // Add to recent laws list
  const itemParsed = parseFrequentLawTitle(parsedLawData.title);
  addToRecentLaws(loadedLawId, {
    tipo: itemParsed.tipo,
    numero: itemParsed.numero,
    titulo: itemParsed.titulo,
    ori: window.location.href.includes('e2911dff3722eec50325724a006a2da0') ? 'D' : 'L'
  });
}

function isFrontMatterNoise(line) {
  const t = (line || '').trim();
  if (!t) return true;
  if (/^(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N)$/i.test(t)) return true;
  if (/^N[UÚ]MERO:?$/i.test(t)) return true;
  if (/^\d{1,8}$/.test(t)) return true;
  if (/^(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N)\s*N[°º]?\s*\d+[\w\-]*$/i.test(t)) return true;
  return false;
}

function sanitizeCordobaTitleCandidate(value) {
  const t = (value || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length < 6 || t.length > 220) return '';
  if (isFrontMatterNoise(t)) return '';
  if (/^LEGISLACI[ÓO]N\s+PROVINCIAL$/i.test(t)) return '';
  if (/^LEYES?\s+DE\s+C[ÓO]RDOBA$/i.test(t)) return '';
  return t;
}

function extractCordobaDocTitle(doc) {
  if (!doc) return '';
  const candidates = [];

  const titleEl = doc.querySelector('title');
  if (titleEl?.textContent) candidates.push(titleEl.textContent);

  doc.querySelectorAll('h1, h2, h3, b, strong').forEach((el) => {
    const txt = el.textContent;
    if (txt) candidates.push(txt);
  });

  for (const candidate of candidates) {
    const clean = sanitizeCordobaTitleCandidate(candidate);
    if (!clean) continue;
    if (/^(C[ÓO]DIGO|CONSTITUCI[ÓO]N|LEY|DECRETO|RESOLUCI[ÓO]N|ESTATUTO)\b/i.test(clean)) {
      return clean;
    }
  }

  for (const candidate of candidates) {
    const clean = sanitizeCordobaTitleCandidate(candidate);
    if (clean) return clean;
  }

  // Third pass: if no descriptive clean title was found, accept even those matching noise filter if they look like a Law/Decreto
  for (const candidate of candidates) {
    const t = (candidate || '').replace(/\s+/g, ' ').trim();
    if (t && /^(LEY|DECRETO|RESOLUCI[ÓO]N|DISPOSICI[ÓO]N)\s*N[°º]?\s*\d+/i.test(t)) {
      return t;
    }
  }

  return '';
}

/**
 * Downloads a law document via AJAX, parses it, and loads it inside the right pane.
 */
async function loadLawInViewer(id, ori, titleHint) {
  loadedLawId = id;
  renderFrequentLaws();
  renderRecentLaws();
  const viewerContainer = document.getElementById('cba-portal-viewer-container');
  if (!viewerContainer) return;
  
  const placeholder = document.getElementById('cba-portal-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  
  injectReaderInContainer(viewerContainer);
  
  // Set up listeners for the newly injected reader
  setupListeners();
  setupEventDelegationForCopy();
  setupTextSearchListeners();
  setupSplitterResizing();
  
  // Fetch text
  const viewPath = (id === 'CP00') ? '6dd74b426f288a67032572340058a003' : (ori === '0' || id.length === 32 ? '0' : (ori === 'D' ? 'e2911dff3722eec50325724a006a2da0' : '6dd74b426f288a67032572340058a003'));
  const lawUrl = `/web/leyes.nsf/${viewPath}/${id}?OpenDocument`;

  try {
    const res = await fetch(lawUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const html = new TextDecoder('windows-1252').decode(buffer);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rawText = getRawTextFromDoc(doc);
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error("No se pudo extraer texto normativo de la página");
    }

    const isGeneric = !titleHint || titleHint.trim() === '' || titleHint.trim().toLowerCase() === 'norma' || titleHint.trim().toLowerCase() === 'normativa de córdoba';
    const docTitle = !isGeneric ? titleHint.trim() : extractCordobaDocTitle(doc);
    await displayLawInReader(rawText, docTitle || null);
  } catch (err) {
    console.error("Error loading law in panel viewer:", err);
    document.getElementById('cba-law-title-text').textContent = "Error al cargar la norma";
    const bodyContent = document.getElementById('cba-reader-body-content');
    if (bodyContent) {
      bodyContent.innerHTML = `
        <div style="padding: 32px; text-align: center; color: var(--accent); font-weight: 500;">
          No se pudo cargar el texto completo de esta norma.<br>
          <a href="${lawUrl}" target="_blank" style="display: inline-block; margin-top: 16px; color: var(--accent); text-decoration: underline;">
            Ver página oficial original
          </a>
        </div>
      `;
    }
  }
}

function setupListeners() {
  document.getElementById('cba-font-dec').addEventListener('click', () => {
    if (settings.fontSize > 70) {
      settings.fontSize -= 10;
      localStorage.setItem('cba-reader-font-size', settings.fontSize);
      applySettings();
    }
  });
  
  document.getElementById('cba-font-inc').addEventListener('click', () => {
    if (settings.fontSize < 160) {
      settings.fontSize += 10;
      localStorage.setItem('cba-reader-font-size', settings.fontSize);
      applySettings();
    }
  });
  
  document.getElementById('cba-font-family').addEventListener('click', () => {
    settings.fontFamily = settings.fontFamily === 'serif' ? 'sans' : 'serif';
    localStorage.setItem('cba-reader-font-family', settings.fontFamily);
    applySettings();
  });
  
  const sidebarToggle = document.getElementById('cba-sidebar-toggle-btn');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('cba-sidebar');
      const splitter = document.getElementById('cba-sidebar-splitter');
      if (sidebar) {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        sidebarToggle.classList.toggle('active');
        if (isCollapsed) {
          sidebar.style.width = '0px';
          sidebar.style.flexBasis = '0px';
          sidebar.style.borderLeft = 'none';
          if (splitter) splitter.style.display = 'none';
        } else {
          const savedWidth = localStorage.getItem('cba-sidebar-width') || '200px';
          sidebar.style.width = savedWidth;
          sidebar.style.flexBasis = savedWidth;
          sidebar.style.borderLeft = '';
          if (splitter) splitter.style.display = 'block';
        }
      }
    });
  }
  
  const searchInput = document.getElementById('cba-search');
  if (searchInput) searchInput.addEventListener('input', (e) => renderArticles(e.target.value));
  
  document.getElementById('cba-download-dropdown-btn').addEventListener('click', () => toggleDropdown('cba-download-menu'));
  document.getElementById('cba-action-copy').addEventListener('click', copyFullText);
  document.getElementById('cba-action-pdf-direct').addEventListener('click', exportToPdfDirect);
  document.getElementById('cba-action-print').addEventListener('click', printLaw);
  document.getElementById('cba-action-docx').addEventListener('click', exportToDocx);
  document.getElementById('cba-action-md').addEventListener('click', exportToMarkdown);
  
  const backToTopBtn = document.getElementById('cba-back-to-top');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      const contentWrapper = document.getElementById('cba-content-wrapper');
      if (contentWrapper) contentWrapper.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  // Create permanent floating return button if not present
  ensureFloatingReturnButton();
}

function setupTextSearchListeners() {
  const textInput = document.getElementById('cba-in-text-search');
  if (!textInput) return;
  textInput.addEventListener('input', (e) => performTextSearch(e.target.value));
  document.getElementById('cba-search-prev').addEventListener('click', () => {
    if (textMatches.length > 0) {
      currentMatchIndex = (currentMatchIndex - 1 + textMatches.length) % textMatches.length;
      highlightCurrentMatch();
    }
  });
  document.getElementById('cba-search-next').addEventListener('click', () => {
    if (textMatches.length > 0) {
      currentMatchIndex = (currentMatchIndex + 1) % textMatches.length;
      highlightCurrentMatch();
    }
  });
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('cba-search-next').click();
    }
  });
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('cba-download-menu');
  const btn = document.getElementById('cba-download-dropdown-btn');
  if (dropdown && btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove('show');
  }
});

let initRetryCount = 0;
const MAX_INIT_RETRIES = 20;

async function init() {
  const urlLower = window.location.href.toLowerCase();
  if (!urlLower.includes('/web/leyes.nsf')) {
    return; // Not on the laws database
  }

  const isDocPage = urlLower.includes('opendocument');
  
  // Always load the portal SPA workspace
  document.body.classList.add('cba-portal-active');
  createPortalUi();
  
  if (isDocPage) {
    const idMatch = window.location.href.match(/\/([0-9a-fA-Z]{2,64})\?OpenDocument/i);
    if (idMatch) {
      loadedLawId = idMatch[1];
    }
    let rawText = '';
    try {
      const res = await fetch(window.location.href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const html = new TextDecoder('windows-1252').decode(buffer);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      rawText = getRawTextFromDoc(doc);
    } catch (e) {
      console.warn('CBA Reader: Error re-fetching page with windows-1252, falling back to local DOM:', e);
      rawText = getRawTextFromDoc(document);
    }

    if (!rawText || rawText.trim().length === 0) {
      if (initRetryCount < MAX_INIT_RETRIES) {
        initRetryCount += 1;
        setTimeout(init, 500);
      } else {
        console.warn('CBA Reader: no se pudo extraer texto de la norma tras varios intentos.');
      }
      return;
    }
    initRetryCount = 0;

    const viewerContainer = document.getElementById('cba-portal-viewer-container');
    const placeholder = document.getElementById('cba-portal-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    injectReaderInContainer(viewerContainer);
    setupListeners();
    setupEventDelegationForCopy();
    setupTextSearchListeners();
    setupSplitterResizing();
    const initialTitle = extractCordobaDocTitle(document);
    await displayLawInReader(rawText, initialTitle || null);
  } else {
    const initialResults = scrapeDOMResults();
    renderResultsList(initialResults);
  }
  
  applySettings();
}

function checkAndInit() {
  chrome.storage.local.get(['ilp-settings'], (data) => {
    const settings = data['ilp-settings'] || {};
    if (settings.enableCordoba === false) {
      console.log('Leyes-Plus Argentina: Módulo Leyes de Córdoba desactivado por configuración.');
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
}

checkAndInit();

})();
