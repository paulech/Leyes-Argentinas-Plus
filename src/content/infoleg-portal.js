/* ==========================================================================
   Leyes-Plus Argentina — Portal & Workspace SPA Content Script
   ========================================================================== */

(function () {
  'use strict';

  // Bypass if explicitly requested via URL parameter
  if (window.location.search.includes('ilp-bypass=true') || window.location.search.includes('no-ext=true')) {
    return;
  }

  const ILP = window.ILP || {};
  const { bgFetch, htmlToText, parser, ui } = ILP;

  // State Management
  let wsActive = false;
  let wsEl = null;
  let currentLawId = '';
  let currentLawMeta = null;
  let currentLawData = null;
  let currentTextType = 'actualizado'; // 'actualizado' (texact.htm) or 'completo' (norma.htm)
  let activeDropdown = null;
  let fontSize = parseInt(localStorage.getItem('ilp-font-size')) || 100;

  // Selectors helpers
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  // Determine current page characteristics
  const params = new URLSearchParams(window.location.search);
  const pageId = params.get('page_id');
  const isSearchPage = /\/infolegInternet\/buscarNormas\.do/.test(window.location.pathname) ||
                       /\/infolegInternet\/mostrarBusquedaNormas\.do/.test(window.location.pathname);
  const isIframeMode = (window.parent !== window);

  // If we are inside an iframe on servicios, we do nothing in this script
  if (isIframeMode) return;

  // Initialize script
  function init() {
    buildWorkspaceDOM();
    setupGlobalLinkInterceptor();
    applyWordPressSkins();

    // If we are directly loading a search page, immediately launch the workspace!
    if (isSearchPage) {
      enterWorkspace();
      const idParam = params.get('id');
      if (idParam) {
        loadLawInWorkspace(idParam);
      } else if (params.get('ilp-search') === '1' || params.get('tipoNorma') || params.get('numero') || params.get('anioSancion')) {
        // Pre-populate search fields in workspace sidebar
        const tipo = params.get('tipoNorma') || '';
        const numero = params.get('numero') || '';
        const anio = params.get('anioSancion') || '';
        
        const tipoSelect = qs('#ilp-ws-tipo', wsEl);
        const numeroInput = qs('#ilp-ws-numero', wsEl);
        const anioInput = qs('#ilp-ws-anio', wsEl);
        
        if (tipoSelect) tipoSelect.value = tipo;
        if (numeroInput) numeroInput.value = numero;
        if (anioInput) {
          anioInput.value = anio;
          if (tipo === '1') {
            anioInput.disabled = true;
            anioInput.value = '';
          }
        }
        
        // Trigger workspace search programmatically
        const fakeEvent = { preventDefault: () => {} };
        handleWorkspaceSearch(fakeEvent);
      } else {
        scrapeAndRenderPageResults();
      }
    }
  }

  // -----------------------------------------------------------------------
  // WordPress Page Skins
  // -----------------------------------------------------------------------
  function applyWordPressSkins() {
    const isHome = window.location.pathname === '/' || window.location.pathname === '/index.php';
    const isSkinned = (pageId === '67' || pageId === '63' || (isHome && !pageId) || (pageId && pageId !== ''));
    
    if (isSkinned) {
      document.body.classList.add('ilp-skinned-page', 'ilp-root');
      document.body.setAttribute('data-theme', 'light');
    }
    
    if (pageId === '67') {
      // Códigos Nacionales
      skinCodesPage();
    } else if (pageId === '63') {
      // Constitución Nacional
      skinConstitutionPage();
    } else if (isHome && !pageId) {
      // General Home
      skinGeneralPortal();
    }
  }

  function skinCodesPage() {
    const content = qs('#content') || qs('.entry-content');
    if (!content) return;
    document.body.classList.add('ilp-skinned-page');

    // Find all links referencing a norm
    const links = qsa('a[href*="verNorma.do"]', content);
    if (links.length === 0) return;

    const grid = document.createElement('div');
    grid.className = 'ilp-codes-grid';

    links.forEach((a) => {
      const href = a.getAttribute('href');
      const m = href.match(/[?&]id=(\d+)/);
      if (!m) return;
      const id = m[1];
      const title = a.textContent.trim();

      const card = document.createElement('a');
      card.className = 'ilp-code-card';
      card.href = href;
      card.dataset.id = id;
      card.innerHTML = `
        <div class="ilp-code-card-icon">📖</div>
        <div class="ilp-code-card-title">${title}</div>
        <div class="ilp-code-card-desc">Carga directa del texto actualizado y consolidado en el mismo panel de lectura.</div>
      `;
      grid.appendChild(card);
    });

    const titleEl = qs('h1', content) || qs('.entry-title', content);
    content.innerHTML = '';
    if (titleEl) content.appendChild(titleEl);
    content.appendChild(grid);
  }

  function skinConstitutionPage() {
    const content = qs('#content') || qs('.entry-content');
    if (!content) return;
    document.body.classList.add('ilp-skinned-page');

    const link = qs('a[href*="verNorma.do"]', content);
    if (!link) return;

    const href = link.getAttribute('href');
    const m = href.match(/[?&]id=(\d+)/);
    if (!m) return;
    const id = m[1];

    const featured = document.createElement('div');
    featured.className = 'ilp-constitution-featured';
    featured.innerHTML = `
      <div class="ilp-constitution-icon">⚖️</div>
      <div class="ilp-constitution-title">Constitución de la Nación Argentina</div>
      <div class="ilp-constitution-desc">Texto constitucional sancionado en 1853, con las reformas de 1860, 1866, 1898, 1957 y 1994. Accedé al texto unificado de forma directa.</div>
      <a href="${href}" class="ilp-btn-primary" data-id="${id}" style="text-decoration:none;display:inline-block;margin-top:8px;">Leer Constitución</a>
    `;

    const titleEl = qs('h1', content) || qs('.entry-title', content);
    content.innerHTML = '';
    if (titleEl) content.appendChild(titleEl);
    content.appendChild(featured);
  }

  function skinGeneralPortal() {
    document.body.classList.add('ilp-skinned-page');
    
    // Remove sidebar widget if it exists
    const secondary = qs('#secondary');
    if (secondary) secondary.remove();

    // Replace header image with a modern, high-end HTML branding section
    const header = qs('#header');
    if (header) {
      header.innerHTML = `
        <div class="ilp-portal-header">
          <div class="ilp-portal-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span>Leyes-Plus Argentina</span>
          </div>
          <div class="ilp-portal-tagline">Portal Federal de Búsqueda e Información Legislativa</div>
        </div>
      `;
    }

    // Reconstruct search form for gorgeous layout & alignment
    const busquedasHome = qs('#busquedas_home');
    if (busquedasHome) {
      busquedasHome.innerHTML = `
        <form action="/?page_id=112" method="POST" name="busquedaNormasForm" class="ilp-home-search-form">
          <div class="ilp-search-field">
            <label for="tipoNorma">Tipo de norma</label>
            <select name="tipoNorma" id="tipoNorma">
              <option value="" selected>Seleccione tipo...</option>
              <option value="1">Ley</option>
              <option value="2">Decreto</option>
              <option value="8">Decisión Administrativa</option>
              <option value="3">Resolución</option>
              <option value="4">Disposición</option>
              <option value="12">Acordada</option>
              <option value="17">Acuerdo</option>
              <option value="5">Circular</option>
              <option value="6">Comunicación</option>
              <option value="7">Decreto/Ley</option>
              <option value="16">Nota</option>
              <option value="22">Recomendación</option>
            </select>
          </div>
          <div class="ilp-search-field">
            <label for="numero">Número</label>
            <input type="text" name="numero" id="numero" placeholder="Ej. 20744" />
          </div>
          <div class="ilp-search-field">
            <label for="anioSancion" id="anioLabel">Año de Sanción</label>
            <input type="text" name="anioSancion" id="anioSancion" maxlength="4" placeholder="Ej. 1974" />
          </div>
          <div class="ilp-search-actions">
            <button type="submit" name="busquedaRapida" value="Buscar" class="ilp-btn-primary">Buscar</button>
            <div class="ilp-search-links">
              <a href="https://www.infoleg.gob.ar/?page_id=112">Búsqueda por Texto</a>
              <span class="sep">|</span>
              <a href="https://www.infoleg.gob.ar/?page_id=216">Por Boletín Oficial</a>
            </div>
          </div>
        </form>
      `;

      // Match original disabling behavior of Year for Leyes
      const tNorma = qs('#tipoNorma', busquedasHome);
      const aSancion = qs('#anioSancion', busquedasHome);
      const aLabel = qs('#anioLabel', busquedasHome);
      if (tNorma && aSancion && aLabel) {
        const updateYearState = () => {
          if (tNorma.value === "1") {
            aSancion.disabled = true;
            aSancion.value = "";
            aLabel.classList.add('disabled-label');
          } else {
            aSancion.disabled = false;
            aLabel.classList.remove('disabled-label');
          }
        };
        tNorma.addEventListener('change', updateYearState);
        updateYearState();
      }

      // Intercept submit event to redirect to same-origin search page in Workspace
      const form = qs('.ilp-home-search-form', busquedasHome);
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const tipo = qs('#tipoNorma', form)?.value || '';
          const numero = (qs('#numero', form)?.value || '').replace(/\./g, '');
          const anio = qs('#anioSancion', form)?.value || '';
          const proto = window.location.protocol;
          window.location.href = `${proto}//servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do?tipoNorma=${tipo}&numero=${numero}&anioSancion=${anio}&ilp-search=1`;
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Global Link Interception
  // -----------------------------------------------------------------------
  function setupGlobalLinkInterceptor() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';

      // Match verNorma.do?id=XXXX
      const m = href.match(/verNorma\.do.*[?&]id=(\d+)/);
      if (m) {
        e.preventDefault();
        const lawId = m[1];
        if (isSearchPage) {
          loadLawInWorkspace(lawId);
        } else {
          const proto = window.location.protocol;
          window.location.href = `${proto}//servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do?id=${lawId}`;
        }
        return;
      }

      // Match direct text links: /anexos/X-Y/id/norma.htm or texact.htm
      if (href.includes('anexos/') && (href.includes('norma.htm') || href.includes('texact.htm'))) {
        const idMatch = href.match(/\/?anexos\/\d+-\d+\/(\d+)\//);
        if (idMatch) {
          e.preventDefault();
          const lawId = idMatch[1];
          if (isSearchPage) {
            loadLawInWorkspace(lawId);
          } else {
            const proto = window.location.protocol;
            window.location.href = `${proto}//servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do?id=${lawId}`;
          }
          return;
        }
      }
    });
  }

  // -----------------------------------------------------------------------
  // Workspace UI Builder
  // -----------------------------------------------------------------------
  function buildWorkspaceDOM() {
    // FAB Toggle
    const fab = document.createElement('button');
    fab.id = 'ilp-fab';
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
    fab.title = 'Abrir Espacio de Trabajo — Leyes-Plus Argentina';
    fab.addEventListener('click', () => {
      if (isSearchPage) {
        if (wsActive) exitWorkspace();
        else enterWorkspace();
      } else {
        const proto = window.location.protocol;
        window.location.href = `${proto}//servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do`;
      }
    });
    document.body.appendChild(fab);

    // If we are not on the search page, do not build the workspace DOM elements
    if (!isSearchPage) return;

    // Workspace container
    wsEl = document.createElement('div');
    wsEl.id = 'ilp-workspace';
    wsEl.className = 'ilp-root hidden';
    wsEl.setAttribute('data-theme', localStorage.getItem('ilp-theme') || 'light');

    wsEl.innerHTML = `
      <div id="ilp-ws-header">
        <div class="ilp-ws-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span>Leyes-Plus Argentina</span>
        </div>
        <div class="ilp-ws-header-actions">
          <button id="ilp-ws-theme-toggle" class="ilp-btn-icon" title="Cambiar tema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 18.36l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <button id="ilp-ws-exit" class="ilp-btn">Volver al Portal</button>
        </div>
      </div>
      <div id="ilp-ws-body">
        <div id="ilp-ws-sidebar">
          <form id="ilp-ws-search-form">
            <h3>Buscador de Normas</h3>
            <div class="ilp-ws-field">
              <label>Tipo de Norma</label>
              <select id="ilp-ws-tipo">
                <option value="">Todos</option>
                <option value="1">Ley</option>
                <option value="2">Decreto</option>
                <option value="8">Dec. Administrativa</option>
                <option value="3">Resolución</option>
                <option value="4">Disposición</option>
              </select>
            </div>
            <div class="ilp-ws-field">
              <label>Número</label>
              <input id="ilp-ws-numero" type="text" placeholder="Ej. 20744" />
            </div>
            <div class="ilp-ws-field">
              <label>Año</label>
              <input id="ilp-ws-anio" type="text" maxlength="4" placeholder="Ej. 1974" />
            </div>
            <button type="submit" class="ilp-btn-primary">Buscar</button>
          </form>
          <div id="ilp-ws-results-count"></div>
          <div id="ilp-ws-results">
            <div class="ilp-ws-empty-state">Realizá una búsqueda para ver los resultados aquí.</div>
          </div>
        </div>
        <div id="ilp-ws-main">
          <div id="ilp-ws-reader-welcome">
            <div class="ilp-welcome-box">
              <h2>Leyes-Plus Argentina</h2>
              <p>Bienvenido al espacio de trabajo avanzado. Buscá o hacé clic en un código a continuación para cargar su contenido interactivo en la misma pestaña.</p>
              <div class="ilp-welcome-chips">
                <div class="ilp-welcome-chip" data-id="239509">
                  <strong>Código Civil y Comercial</strong>
                  <span>Texto Consolidado (Ley 26.994)</span>
                </div>
                <div class="ilp-welcome-chip" data-id="16538">
                  <strong>Código Penal</strong>
                  <span>Ley 11.179 con modificatorias</span>
                </div>
                <div class="ilp-welcome-chip" data-id="804">
                  <strong>Constitución Nacional</strong>
                  <span>Texto constitucional vigente</span>
                </div>
                <div class="ilp-welcome-chip" data-id="20744">
                  <strong>Ley de Contrato de Trabajo</strong>
                  <span>Ley 20.744 texto actualizado</span>
                </div>
              </div>
            </div>
          </div>
          <div id="ilp-ws-reader" class="hidden">
            <div id="ilp-ws-reader-toolbar">
              <div class="ilp-ws-reader-meta">
                <span id="ilp-ws-reader-law-type">-</span>
                <span id="ilp-ws-reader-law-num">-</span>
              </div>
              <div class="ilp-ws-reader-actions">
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
                <button id="ilp-ws-open-tab" class="ilp-btn" title="Abrir en pestaña nueva">↗</button>
              </div>
            </div>
            <div id="ilp-ws-reader-content">
              <!-- Rendered law content -->
            </div>
            <button class="ilp-back-to-top" id="ilp-ws-back-to-top" title="Volver al inicio" aria-label="Volver al inicio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wsEl);

    // Setup Event Listeners inside Workspace
    qs('#ilp-ws-search-form', wsEl).addEventListener('submit', handleWorkspaceSearch);
    qs('#ilp-ws-exit', wsEl).addEventListener('click', exitWorkspace);
    qs('#ilp-ws-theme-toggle', wsEl).addEventListener('click', cycleTheme);

    // Welcome cards
    qsa('.ilp-welcome-chip', wsEl).forEach((chip) => {
      chip.addEventListener('click', () => {
        loadLawInWorkspace(chip.dataset.id);
      });
    });

    // Version buttons toggle
    qs('#ilp-ws-ver-actualizado', wsEl).addEventListener('click', () => {
      if (currentTextType === 'actualizado') return;
      currentTextType = 'actualizado';
      qs('#ilp-ws-ver-actualizado', wsEl).classList.add('active');
      qs('#ilp-ws-ver-completo', wsEl).classList.remove('active');
      renderCurrentLawText();
    });
    qs('#ilp-ws-ver-completo', wsEl).addEventListener('click', () => {
      if (currentTextType === 'completo') return;
      currentTextType = 'completo';
      qs('#ilp-ws-ver-completo', wsEl).classList.add('active');
      qs('#ilp-ws-ver-actualizado', wsEl).classList.remove('active');
      renderCurrentLawText();
    });

    // Related regulations dropdown buttons toggles
    setupDropdownToggle(qs('#ilp-ws-rel-modifica', wsEl), qs('#ilp-ws-menu-modifica', wsEl));
    setupDropdownToggle(qs('#ilp-ws-rel-modificada-por', wsEl), qs('#ilp-ws-menu-modificada-por', wsEl));

    // Font settings
    const applyFontSettings = () => {
      const content = qs('#ilp-ws-reader-content', wsEl);
      if (content) {
        content.style.fontSize = `${fontSize}%`;
      }
    };

    qs('#ilp-ws-font-dec', wsEl).addEventListener('click', () => {
      if (fontSize > 70) {
        fontSize -= 10;
        localStorage.setItem('ilp-font-size', fontSize);
        applyFontSettings();
      }
    });
    qs('#ilp-ws-font-inc', wsEl).addEventListener('click', () => {
      if (fontSize < 160) {
        fontSize += 10;
        localStorage.setItem('ilp-font-size', fontSize);
        applyFontSettings();
      }
    });

    // Toolbar actions
    qs('#ilp-ws-copy-cite', wsEl).addEventListener('click', copyCiteToClipboard);
    qs('#ilp-ws-export-pdf', wsEl).addEventListener('click', handleExportPDF);
    qs('#ilp-ws-export-docx', wsEl).addEventListener('click', handleExportDOCX);
    qs('#ilp-ws-open-tab', wsEl).addEventListener('click', () => {
      if (currentLawId) {
        window.open(`https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${currentLawId}`, '_blank');
      }
    });

    // Back-to-top wedge button: show on scroll, click → scroll to top
    const backToTopBtn = qs('#ilp-ws-back-to-top', wsEl);
    const scrollContent = qs('#ilp-ws-reader-content', wsEl);
    if (backToTopBtn && scrollContent) {
      scrollContent.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('visible', scrollContent.scrollTop > 300);
      }, { passive: true });
      backToTopBtn.addEventListener('click', () => {
        scrollContent.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Close dropdowns on document click
    document.addEventListener('click', (e) => {
      if (activeDropdown && !e.target.closest('.ilp-dropdown-container')) {
        activeDropdown.classList.add('hidden');
        activeDropdown = null;
      }
    });
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

  // -----------------------------------------------------------------------
  // Workspace Actions (Enter / Exit / Theme Toggle)
  // -----------------------------------------------------------------------
  function enterWorkspace() {
    if (!wsEl) return;
    wsActive = true;
    document.body.classList.add('ilp-workspace-active');
    wsEl.classList.remove('hidden');
  }

  // Exit restore
  function exitWorkspace() {
    wsActive = false;
    document.body.classList.remove('ilp-workspace-active');
    if (wsEl) wsEl.classList.add('hidden');
    // If we loaded the search page directly, exiting workspace should go home
    if (isSearchPage) {
      const proto = window.location.protocol;
      window.location.href = `${proto}//www.infoleg.gob.ar/`;
    }
  }

  function cycleTheme() {
    const themes = ['light', 'sepia', 'dark'];
    let cur = wsEl.getAttribute('data-theme') || 'light';
    let idx = (themes.indexOf(cur) + 1) % themes.length;
    let nextTheme = themes[idx];
    wsEl.setAttribute('data-theme', nextTheme);
    localStorage.setItem('ilp-theme', nextTheme);
  }

  // -----------------------------------------------------------------------
  // Search Functionality (SPA fetch to buscarNormas.do via background)
  // -----------------------------------------------------------------------
  async function handleWorkspaceSearch(e) {
    e.preventDefault();
    const val = (id) => (qs('#' + id, wsEl)?.value || '').trim();
    const tipo = val('ilp-ws-tipo');
    const numero = val('ilp-ws-numero');
    const anio = val('ilp-ws-anio');

    if (!tipo && !numero && !anio) {
      if (ui) ui.toast('Completá al menos un parámetro de búsqueda', 'error');
      return;
    }

    const resultsArea = qs('#ilp-ws-results', wsEl);
    resultsArea.innerHTML = '<div class="ilp-ws-loading-state">Buscando en InfoLeg...</div>';
    qs('#ilp-ws-results-count', wsEl).textContent = '';

    try {
      const params = new URLSearchParams();
      params.append('tipoNorma', tipo || '');
      params.append('numero', numero ? numero.replace(/\./g, '') : '');
      params.append('anioSancion', anio || '');
      params.append('buscar', 'Buscar');

      const res = await bgFetch('https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do', {
        method: 'POST',
        body: params.toString()
      });

      // Handle single result redirects automatically
      if (res.url && res.url.includes('verNorma.do')) {
        const m = res.url.match(/[?&]id=(\d+)/);
        if (m) {
          loadLawInWorkspace(m[1]);
          resultsArea.innerHTML = '<div class="ilp-ws-empty-state">Búsqueda redirigida directamente a la norma.</div>';
          return;
        }
      }

      const buffer = await res.arrayBuffer();
      const { text: html } = ILP.decodeBuffer(buffer);
      const results = parseSearchResultsHTML(html);
      renderResults(results);
    } catch (err) {
      console.error('Error searching norms:', err);
      resultsArea.innerHTML = '<div class="ilp-ws-empty-state" style="color:var(--ilp-accent);">Fallo al consultar base de datos InfoLeg. Intentá nuevamente.</div>';
    }
  }

  function parseSearchResultsHTML(html) {
    const parserDoc = new DOMParser();
    const doc = parserDoc.parseFromString(html, 'text/html');
    const results = [];
    const anchors = doc.querySelectorAll('table a[href*="verNorma.do"]');
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/[?&]id=(\d+)/);
      if (!m) return;
      const id = m[1];
      const row = a.closest('tr');
      let tipo = '', numero = '', titulo = '', fecha = '';
      if (row) {
        const cells = Array.from(row.querySelectorAll('td')).map((c) => c.textContent.trim());
        if (cells.length >= 3) {
          const first = cells[0] || '';
          const m2 = first.match(/(Ley|Decreto|Resoluci[oó]n|Disposici[oó]n|Decisi[oó]n\s*Administrativa|Acordada|Acta|Acuerdo|Circular|Comunicaci[oó]n|Decreto\/Ley|Directiva|Instrucci[oó]n|Nota|Protocolo|Providencia|Recomendaci[oó]n|Ordenanza)/i);
          tipo = m2 ? m2[1] : 'Norma';
          const nm = first.match(/(\d+[\.\d+]*)/);
          numero = nm ? nm[1] : '';
          fecha = cells[1] || '';
          titulo = cells[2] || cells[cells.length - 1] || '';
        }
      }
      results.push({
        id,
        tipo: tipo || 'Norma',
        numero: numero || id,
        titulo: titulo || `Norma ${id}`,
        fecha,
        url: 'https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=' + id
      });
    });
    return results;
  }

  function scrapeAndRenderPageResults() {
    const results = parseSearchResultsHTML(document.body.innerHTML);
    if (results.length > 0) {
      renderResults(results);
    }
  }

  function renderResults(results) {
    const resultsArea = qs('#ilp-ws-results', wsEl);
    resultsArea.innerHTML = '';
    const countEl = qs('#ilp-ws-results-count', wsEl);

    if (!results || results.length === 0) {
      countEl.textContent = 'Sin resultados';
      resultsArea.innerHTML = '<div class="ilp-ws-empty-state">No se encontraron normas con esos criterios.</div>';
      return;
    }

    countEl.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;

    results.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'ilp-ws-card';
      if (r.id === currentLawId) card.classList.add('active');

      card.innerHTML = `
        <div class="ilp-ws-card-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="ilp-ws-card-badge">${r.tipo} N° ${r.numero}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="ilp-ws-card-date">${r.fecha}</span>
            <button class="ilp-ws-card-newtab-btn" title="Abrir en nueva pestaña">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>
        <div class="ilp-ws-card-title">${r.titulo}</div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.ilp-ws-card-newtab-btn')) {
          e.stopPropagation();
          window.open(r.url, '_blank');
          return;
        }
        qsa('.ilp-ws-card', resultsArea).forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        loadLawInWorkspace(r.id);
      });

      resultsArea.appendChild(card);
    });
  }

  // -----------------------------------------------------------------------
  // Reader Logic (Scraping law verNorma.do + texact.htm/norma.htm)
  // -----------------------------------------------------------------------
  async function loadLawInWorkspace(id) {
    if (!id) return;
    currentLawId = id;
    
    // Always default to updated version when opening a new norm
    currentTextType = 'actualizado';
    const btnActualizado = qs('#ilp-ws-ver-actualizado', wsEl);
    const btnCompleto = qs('#ilp-ws-ver-completo', wsEl);
    if (btnActualizado && btnCompleto) {
      btnActualizado.classList.add('active');
      btnCompleto.classList.remove('active');
    }

    // Show reader pane and hide welcome screen
    qs('#ilp-ws-reader-welcome', wsEl).classList.add('hidden');
    const readerPane = qs('#ilp-ws-reader', wsEl);
    readerPane.classList.remove('hidden');

    const contentArea = qs('#ilp-ws-reader-content', wsEl);
    contentArea.innerHTML = '<div class="ilp-reader-loading">Consultando detalles de la norma...</div>';

    // Clear related list count and menus
    qs('#ilp-ws-rel-modifica .badge', wsEl).textContent = '0';
    qs('#ilp-ws-rel-modificada-por .badge', wsEl).textContent = '0';
    qs('#ilp-ws-menu-modifica', wsEl).innerHTML = '';
    qs('#ilp-ws-menu-modificada-por', wsEl).innerHTML = '';

    try {
      const url = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${id}`;
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

      // Default fallback
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
      qs('#ilp-ws-reader-law-type', wsEl).textContent = tipo;
      qs('#ilp-ws-reader-law-num', wsEl).textContent = `N° ${numero}`;

      // Reset and load actual text
      currentLawData = {};
      await fetchAndParseText(textUrl, originalTextUrl);

      // Async fetch relationships links (vinculos)
      fetchLawRelationships(id);
    } catch (err) {
      console.error('Error fetching law details:', err);
      contentArea.innerHTML = '<div class="ilp-reader-loading">Error al cargar los detalles de esta norma. ¿Tiene conexión a internet?</div>';
    }
  }

  async function fetchAndParseText(updatedUrl, originalUrl) {
    const contentArea = qs('#ilp-ws-reader-content', wsEl);
    contentArea.innerHTML = '<div class="ilp-reader-loading">Descargando y formateando texto normativo...</div>';

    const targetUrl = currentTextType === 'actualizado' ? updatedUrl : originalUrl;

    try {
      const res = await bgFetch(targetUrl);
      
      if (!res.ok && currentTextType === 'actualizado') {
        currentTextType = 'completo';
        qs('#ilp-ws-ver-completo', wsEl).classList.add('active');
        qs('#ilp-ws-ver-actualizado', wsEl).classList.remove('active');
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
        const fallbackUrl = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${currentLawId}`;
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
    const contentArea = qs('#ilp-ws-reader-content', wsEl);
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
    contentArea.scrollTop = 0;
  }

  // -----------------------------------------------------------------------
  // Related Regulations Drops Scraping (verVinculos.do via background)
  // -----------------------------------------------------------------------
  async function fetchLawRelationships(id) {
    loadRelationshipMode(id, 1, qs('#ilp-ws-rel-modifica', wsEl), qs('#ilp-ws-menu-modifica', wsEl));
    loadRelationshipMode(id, 2, qs('#ilp-ws-rel-modificada-por', wsEl), qs('#ilp-ws-menu-modificada-por', wsEl));
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
          loadLawInWorkspace(v.id);
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

  // -----------------------------------------------------------------------
  // Cite Copy helper
  // -----------------------------------------------------------------------
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
    if (!currentLawData || !currentLawMeta) return;
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
    if (!currentLawData || !currentLawMeta) return;
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

  // DOM Ready trigger
  chrome.storage.local.get('ilp-enabled', (data) => {
    if (data['ilp-enabled'] === false) {
      console.log('[ILP] InfoLeg-Plus portal is disabled.');
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
})();
