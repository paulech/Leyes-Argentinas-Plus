/* ==========================================================================
   Leyes-Plus Argentina — Standalone Dashboard Controller Script
   ========================================================================== */

(function () {
  'use strict';

  // Grab shared modules from namespace
  const ILP = window.ILP || {};
  const { bgFetch, decodeBuffer, htmlToText, parser, ui } = ILP;

  // State Management
  let currentLawId = '';
  let currentLawMeta = null;
  let currentLawData = {};
  let currentTextType = 'actualizado'; // 'actualizado', 'completo', or 'comparar'
  let activeDropdown = null;

  const settings = {
    fontSize: 100,
    fontFamily: 'serif'
  };

  function applyReaderSettings() {
    const readerContent = qs('#ilp-reader-content');
    if (readerContent) {
      readerContent.style.setProperty('--ilp-reader-font-size', `${settings.fontSize}%`);
      readerContent.style.setProperty('--ilp-reader-font-family', settings.fontFamily === 'serif' ? 'var(--ilp-font-serif)' : 'var(--ilp-font-ui)');
    }
  }

  function saveReaderSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ilp-settings'], (data) => {
        const currentSettings = data['ilp-settings'] || {};
        const newSettings = Object.assign({}, currentSettings, {
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily
        });
        chrome.storage.local.set({ 'ilp-settings': newSettings });
      });
    }
  }
  let textMatches = [];
  let currentMatchIndex = -1;

  const FREQUENT_LAWS = {
    "Bloque Constitucional": [
      {
        "id": "804",
        "tipo": "Const.",
        "numero": "Nacional",
        "titulo": "Constitución de la Nación Argentina"
      },
      {
        "id": "28152",
        "tipo": "Ley",
        "numero": "23.054",
        "titulo": "Convención Americana sobre Derechos Humanos"
      }
    ],
    "Derecho Privado": [
      {
        "id": "235975",
        "tipo": "Código",
        "numero": "CCyC",
        "titulo": "Código Civil y Comercial de la Nación"
      },
      {
        "id": "818",
        "tipo": "Ley",
        "numero": "24.449",
        "titulo": "Ley Nacional de Tránsito"
      },
      {
        "id": "152155",
        "tipo": "Ley",
        "numero": "26.485",
        "titulo": "Ley de Protección Integral a las Mujeres"
      },
      {
        "id": "53050",
        "tipo": "Ley",
        "numero": "17.801",
        "titulo": "Registro de la Propiedad Inmueble"
      },
      {
        "id": "38822",
        "tipo": "Decreto-Ley",
        "numero": "6582/58",
        "titulo": "Régimen Jurídico del Automotor"
      },
      {
        "id": "145345",
        "tipo": "Ley",
        "numero": "26.413",
        "titulo": "Registro del Estado Civil y Capacidad de las Personas"
      },
      {
        "id": "166999",
        "tipo": "Ley",
        "numero": "26.589",
        "titulo": "Mediación Prejudicial Obligatoria"
      },
      {
        "id": "638",
        "tipo": "Ley",
        "numero": "24.240",
        "titulo": "Defensa del Consumidor"
      },
      {
        "id": "42755",
        "tipo": "Ley",
        "numero": "11.723",
        "titulo": "Régimen Legal de la Propiedad Intelectual"
      },
      {
        "id": "18803",
        "tipo": "Ley",
        "numero": "22.362",
        "titulo": "Ley de Marcas y Designaciones"
      },
      {
        "id": "64790",
        "tipo": "Ley",
        "numero": "25.326",
        "titulo": "Protección de los Datos Personales"
      },
      {
        "id": "70368",
        "tipo": "Decreto",
        "numero": "1558/2001",
        "titulo": "Reglamentación Ley 25.326"
      },
      {
        "id": "70749",
        "tipo": "Ley",
        "numero": "25.506",
        "titulo": "Ley de Firma Digital"
      },
      {
        "id": "175977",
        "tipo": "Ley",
        "numero": "26.657",
        "titulo": "Derecho a la Protección de la Salud Mental"
      },
      {
        "id": "160432",
        "tipo": "Ley",
        "numero": "26.529",
        "titulo": "Derechos del Paciente"
      }
    ],
    "Derecho Societario": [
      {
        "id": "25553",
        "tipo": "Ley",
        "numero": "19.550",
        "titulo": "Ley General de Sociedades"
      },
      {
        "id": "273567",
        "tipo": "Ley",
        "numero": "27.349",
        "titulo": "Apoyo al Capital Emprendedor (SAS)"
      },
      {
        "id": "18462",
        "tipo": "Ley",
        "numero": "20.337",
        "titulo": "Ley de Cooperativas"
      },
      {
        "id": "25392",
        "tipo": "Ley",
        "numero": "20.321",
        "titulo": "Ley de Mutuales"
      },
      {
        "id": "25379",
        "tipo": "Ley",
        "numero": "24.522",
        "titulo": "Concursos y Quiebras"
      },
      {
        "id": "310241",
        "tipo": "Ley",
        "numero": "27.442",
        "titulo": "Defensa de la Competencia"
      },
      {
        "id": "322236",
        "tipo": "Decreto",
        "numero": "274/2019",
        "titulo": "Lealtad Comercial"
      },
      {
        "id": "15932",
        "tipo": "Ley",
        "numero": "24.467",
        "titulo": "Pequeña y Mediana Empresa (PyMES)"
      },
      {
        "id": "66194",
        "tipo": "Ley",
        "numero": "24.144",
        "titulo": "Carta Orgánica del BCRA"
      },
      {
        "id": "16071",
        "tipo": "Ley",
        "numero": "21.526",
        "titulo": "Entidades Financieras"
      },
      {
        "id": "206592",
        "tipo": "Ley",
        "numero": "26.831",
        "titulo": "Mercado de Capitales"
      },
      {
        "id": "20643",
        "tipo": "Ley",
        "numero": "23.576",
        "titulo": "Obligaciones Negociables"
      },
      {
        "id": "482",
        "tipo": "Ley",
        "numero": "24.083",
        "titulo": "Fondos Comunes de Inversión"
      },
      {
        "id": "31308",
        "tipo": "Decreto-Ley",
        "numero": "15.348/46",
        "titulo": "Prenda con Registro"
      },
      {
        "id": "37048",
        "tipo": "Ley",
        "numero": "9.643",
        "titulo": "Warrants"
      },
      {
        "id": "69687",
        "tipo": "Decreto-Ley",
        "numero": "5965/63",
        "titulo": "Letras de Cambio y Pagares"
      },
      {
        "id": "14733",
        "tipo": "Ley",
        "numero": "24.452",
        "titulo": "Cheques"
      },
      {
        "id": "55556",
        "tipo": "Ley",
        "numero": "25.065",
        "titulo": "Tarjetas de Crédito"
      },
      {
        "id": "39520",
        "tipo": "Ley",
        "numero": "17.418",
        "titulo": "Seguros"
      }
    ],
    "Derecho Público": [
      {
        "id": "22363",
        "tipo": "Ley",
        "numero": "19.549",
        "titulo": "Procedimientos Administrativos"
      },
      {
        "id": "21715",
        "tipo": "Decreto",
        "numero": "1759/1972",
        "titulo": "Reglamentación Ley 19.549"
      },
      {
        "id": "46871",
        "tipo": "Ley",
        "numero": "16.986",
        "titulo": "Acción de Amparo"
      },
      {
        "id": "38542",
        "tipo": "Ley",
        "numero": "13.064",
        "titulo": "Ley de Obras Públicas"
      },
      {
        "id": "233216",
        "tipo": "Ley",
        "numero": "26.944",
        "titulo": "Responsabilidad del Estado"
      },
      {
        "id": "48356",
        "tipo": "Ley",
        "numero": "24.937",
        "titulo": "Consejo de la Magistratura"
      },
      {
        "id": "265949",
        "tipo": "Ley",
        "numero": "27.275",
        "titulo": "Acceso a la Información Pública"
      },
      {
        "id": "405911",
        "tipo": "Decreto",
        "numero": "971/2024",
        "titulo": "Silencio Positivo"
      },
      {
        "id": "19442",
        "tipo": "Ley",
        "numero": "19.945",
        "titulo": "Código Electoral Nacional"
      }
    ],
    "Derecho Laboral": [
      {
        "id": "25552",
        "tipo": "Ley",
        "numero": "20.744",
        "titulo": "Contrato de Trabajo"
      },
      {
        "id": "47677",
        "tipo": "Ley",
        "numero": "24.901",
        "titulo": "Sistema de Prestaciones Básicas en Discapacidad"
      },
      {
        "id": "46379",
        "tipo": "Ley",
        "numero": "14.250",
        "titulo": "Convenciones Colectivas de Trabajo"
      },
      {
        "id": "412",
        "tipo": "Ley",
        "numero": "24.013",
        "titulo": "Ley Nacional de Empleo"
      },
      {
        "id": "341017",
        "tipo": "Ley",
        "numero": "27.555",
        "titulo": "Régimen Legal del Contrato de Teletrabajo"
      },
      {
        "id": "423680",
        "tipo": "Ley",
        "numero": "27.802",
        "titulo": "Ley de Modernización Laboral"
      },
      {
        "id": "426270",
        "tipo": "Decreto",
        "numero": "407/2026",
        "titulo": "Reglamentación Ley de Modernización Laboral"
      },
      {
        "id": "426272",
        "tipo": "Decreto",
        "numero": "408/2026",
        "titulo": "Fondo de Asistencia Laboral"
      },
      {
        "id": "426271",
        "tipo": "Decreto",
        "numero": "409/2026",
        "titulo": "Régimen de Promoción del Empleo Registrado"
      },
      {
        "id": "401266",
        "tipo": "Ley",
        "numero": "27.742",
        "titulo": "Ley de Bases (Libertad de los Argentinos)"
      },
      {
        "id": "63368",
        "tipo": "Ley",
        "numero": "11.544",
        "titulo": "Ley de Jornada de Trabajo"
      },
      {
        "id": "27971",
        "tipo": "Ley",
        "numero": "24.557",
        "titulo": "Ley de Riesgos del Trabajo"
      },
      {
        "id": "20993",
        "tipo": "Ley",
        "numero": "23.551",
        "titulo": "Asociaciones Sindicales"
      },
      {
        "id": "639",
        "tipo": "Ley",
        "numero": "24.241",
        "titulo": "Sistema Integrado de Jubilaciones y Pensiones"
      },
      {
        "id": "148141",
        "tipo": "Ley",
        "numero": "26.425",
        "titulo": "Sistema Integrado Previsional Argentino (SIPA)"
      },
      {
        "id": "16081",
        "tipo": "Ley",
        "numero": "19.032",
        "titulo": "Creación del INSSJP (PAMI)"
      },
      {
        "id": "62",
        "tipo": "Ley",
        "numero": "23.660",
        "titulo": "Régimen de Obras Sociales"
      },
      {
        "id": "63",
        "tipo": "Ley",
        "numero": "23.661",
        "titulo": "Sistema Nacional del Seguro de Salud"
      },
      {
        "id": "210489",
        "tipo": "Ley",
        "numero": "26.844",
        "titulo": "Régimen Especial de Contrato de Trabajo para el Personal de Casas Particulares"
      }
    ],
    "Derecho Tributario": [
      {
        "id": "18771",
        "tipo": "Ley",
        "numero": "11.683",
        "titulo": "Procedimiento Tributario"
      },
      {
        "id": "332890",
        "tipo": "Ley",
        "numero": "20.628",
        "titulo": "Impuesto a las Ganancias"
      },
      {
        "id": "42701",
        "tipo": "Ley",
        "numero": "23.349",
        "titulo": "Impuesto al Valor Agregado (IVA)"
      },
      {
        "id": "365",
        "tipo": "Ley",
        "numero": "23.966",
        "titulo": "Bienes Personales"
      },
      {
        "id": "38621",
        "tipo": "Ley",
        "numero": "24.674",
        "titulo": "Impuestos Internos"
      },
      {
        "id": "51609",
        "tipo": "Ley",
        "numero": "24.977",
        "titulo": "Monotributo"
      },
      {
        "id": "16536",
        "tipo": "Ley",
        "numero": "22.415",
        "titulo": "Código Aduanero"
      }
    ],
    "Derecho Penal": [
      {
        "id": "16546",
        "tipo": "Código",
        "numero": "Penal",
        "titulo": "Código Penal de la Nación"
      },
      {
        "id": "37872",
        "tipo": "Ley",
        "numero": "24.660",
        "titulo": "Ley de Ejecución de la Pena Privativa de la Libertad"
      },
      {
        "id": "296846",
        "tipo": "Ley",
        "numero": "27.401",
        "titulo": "Responsabilidad Penal Empresaria"
      },
      {
        "id": "305262",
        "tipo": "Ley",
        "numero": "27.430",
        "titulo": "Régimen Penal Tributario (Título IX)"
      },
      {
        "id": "28133",
        "tipo": "Ley",
        "numero": "19.359",
        "titulo": "Régimen Penal Cambiario"
      },
      {
        "id": "62977",
        "tipo": "Ley",
        "numero": "25.246",
        "titulo": "Encubrimiento y Lavado de Activos"
      },
      {
        "id": "138",
        "tipo": "Ley",
        "numero": "23.737",
        "titulo": "Estupefacientes"
      }
    ],
    "Procedimiento y Recursos": [
      {
        "id": "79980",
        "tipo": "Ley",
        "numero": "25.675",
        "titulo": "Ley General del Ambiente"
      },
      {
        "id": "16078",
        "tipo": "Ley",
        "numero": "17.319",
        "titulo": "Ley de Hidrocarburos"
      },
      {
        "id": "43797",
        "tipo": "Código",
        "numero": "Minero",
        "titulo": "Código Minero"
      },
      {
        "id": "43550",
        "tipo": "Ley",
        "numero": "20.094",
        "titulo": "Ley de Navegación"
      },
      {
        "id": "24963",
        "tipo": "Ley",
        "numero": "17.285",
        "titulo": "Código Aeronáutico"
      },
      {
        "id": "16547",
        "tipo": "Código",
        "numero": "CPCCN",
        "titulo": "Código Procesal Civil y Comercial de la Nación"
      },
      {
        "id": "319681",
        "tipo": "Código",
        "numero": "CPPF",
        "titulo": "Código Procesal Penal Federal"
      }
    ]
  };

  // Selectors helpers
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  let resizeLayoutRaf = null;

  function makeElementResizable(handle, target, direction, minWidth, maxWidth, isRightSidebar = false) {
    let startX, startWidth;
    function startDrag(e) {
      e.preventDefault();
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(target).width, 10);
      handle.classList.add('ilp-splitter-active');
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
      handle.classList.remove('ilp-splitter-active');
      document.removeEventListener('mousemove', doDrag, false);
      document.removeEventListener('mouseup', stopDrag, false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(isRightSidebar ? 'ilp-toc-width' : 'ilp-sidebar-width', target.style.width);
    }
    handle.addEventListener('mousedown', startDrag, false);
  }

  function enforceResponsivePaneWidths() {
    const body = qs('#ilp-body');
    const sidebar = qs('#ilp-sidebar');
    const tocSidebar = qs('#ilp-reader-toc');
    const leftSplitter = qs('#ilp-splitter');
    const rightSplitter = qs('#ilp-toc-splitter');
    if (!body || !sidebar || !tocSidebar) return;

    const totalWidth = body.clientWidth || window.innerWidth;
    if (!totalWidth) return;

    const sidebarMin = 240;
    const tocMin = 180;
    const minReadableWidth = 780;

    let sidebarWidth = Math.round(sidebar.getBoundingClientRect().width) || 360;
    let tocWidth = 0;
    const tocVisible = window.getComputedStyle(tocSidebar).display !== 'none';
    if (tocVisible) {
      tocWidth = Math.round(tocSidebar.getBoundingClientRect().width) || 250;
    }

    const splitterWidth =
      (leftSplitter && window.getComputedStyle(leftSplitter).display !== 'none' ? leftSplitter.offsetWidth : 0) +
      (rightSplitter && window.getComputedStyle(rightSplitter).display !== 'none' ? rightSplitter.offsetWidth : 0);

    const currentReadableWidth = totalWidth - sidebarWidth - tocWidth - splitterWidth;
    let deficit = minReadableWidth - currentReadableWidth;
    if (deficit <= 0) return;

    if (tocVisible) {
      const tocShrink = Math.min(deficit, Math.max(0, tocWidth - tocMin));
      if (tocShrink > 0) {
        tocWidth -= tocShrink;
        deficit -= tocShrink;
      }
    }

    const sidebarShrink = Math.min(deficit, Math.max(0, sidebarWidth - sidebarMin));
    if (sidebarShrink > 0) {
      sidebarWidth -= sidebarShrink;
      deficit -= sidebarShrink;
    }

    sidebar.style.width = `${sidebarWidth}px`;
    sidebar.style.flexBasis = `${sidebarWidth}px`;
    if (tocVisible) {
      tocSidebar.style.width = `${tocWidth}px`;
      tocSidebar.style.flexBasis = `${tocWidth}px`;
    }
  }

  function handleViewportResize() {
    if (resizeLayoutRaf) {
      cancelAnimationFrame(resizeLayoutRaf);
    }
    resizeLayoutRaf = requestAnimationFrame(() => {
      resizeLayoutRaf = null;
      enforceResponsivePaneWidths();
    });
  }

  // Initialize
  function init() {
    // Check if theme was saved
    const savedTheme = localStorage.getItem('ilp-theme') || 'light';
    applyTheme(savedTheme);

    // Retrieve storage settings
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ilp-settings'], (data) => {
        const stored = data['ilp-settings'] || {};
        if (stored.theme) {
          applyTheme(stored.theme);
        }
        if (stored.fontSize) settings.fontSize = stored.fontSize;
        if (stored.fontFamily) settings.fontFamily = stored.fontFamily;
        applyReaderSettings();
      });
    } else {
      applyReaderSettings();
    }

    // Setup Splitter Resizing
    const sidebar = qs('#ilp-sidebar');
    const sidebarSplitter = qs('#ilp-splitter');
    if (sidebar && sidebarSplitter) {
      const savedWidth = localStorage.getItem('ilp-sidebar-width');
      if (savedWidth) {
        sidebar.style.width = savedWidth;
        sidebar.style.flexBasis = savedWidth;
      }
      makeElementResizable(sidebarSplitter, sidebar, 'horizontal', 240, 600, false);
    }

    const tocSidebar = qs('#ilp-reader-toc');
    const tocSplitter = qs('#ilp-toc-splitter');
    if (tocSidebar && tocSplitter) {
      const savedWidth = localStorage.getItem('ilp-toc-width');
      if (savedWidth) {
        tocSidebar.style.width = savedWidth;
        tocSidebar.style.flexBasis = savedWidth;
      }
      makeElementResizable(tocSplitter, tocSidebar, 'horizontal', 180, 450, true);
    }

    enforceResponsivePaneWidths();
    window.addEventListener('resize', handleViewportResize);

    // Event Listeners
    qs('#ilp-theme-toggle').addEventListener('click', cycleTheme);
    qs('#ilp-search-form').addEventListener('submit', handleSearch);

    // Font size and family controls
    qs('#ilp-btn-font-dec').addEventListener('click', () => {
      if (settings.fontSize > 70) {
        settings.fontSize -= 10;
        applyReaderSettings();
        saveReaderSettings();
      }
    });

    qs('#ilp-btn-font-inc').addEventListener('click', () => {
      if (settings.fontSize < 160) {
        settings.fontSize += 10;
        applyReaderSettings();
        saveReaderSettings();
      }
    });

    qs('#ilp-btn-font-family').addEventListener('click', () => {
      settings.fontFamily = settings.fontFamily === 'serif' ? 'sans' : 'serif';
      applyReaderSettings();
      saveReaderSettings();
    });

    // Welcome chips direct load
    qsa('.ilp-chip-card').forEach((chip) => {
      chip.addEventListener('click', () => {
        loadLaw(chip.dataset.id);
      });
    });

    // Sidebar Tabs Switcher
    const tabSearch = qs('#ilp-tab-btn-search');
    const tabLibrary = qs('#ilp-tab-btn-library');
    const panelSearch = qs('#ilp-panel-search');
    const panelLibrary = qs('#ilp-panel-library');

    if (tabSearch && tabLibrary && panelSearch && panelLibrary) {
      tabSearch.addEventListener('click', () => {
        tabSearch.classList.add('active');
        tabLibrary.classList.remove('active');
        
        tabSearch.style.borderBottom = '2px solid var(--ilp-accent)';
        tabSearch.style.color = 'var(--ilp-text-0)';
        tabSearch.style.fontWeight = '700';
        
        tabLibrary.style.borderBottom = '2px solid transparent';
        tabLibrary.style.color = 'var(--ilp-text-2)';
        tabLibrary.style.fontWeight = '600';
        
        panelSearch.classList.remove('hidden');
        panelLibrary.classList.add('hidden');
      });

      tabLibrary.addEventListener('click', () => {
        tabLibrary.classList.add('active');
        tabSearch.classList.remove('active');
        
        tabLibrary.style.borderBottom = '2px solid var(--ilp-accent)';
        tabLibrary.style.color = 'var(--ilp-text-0)';
        tabLibrary.style.fontWeight = '700';
        
        tabSearch.style.borderBottom = '2px solid transparent';
        tabSearch.style.color = 'var(--ilp-text-2)';
        tabSearch.style.fontWeight = '600';
        
        panelLibrary.classList.remove('hidden');
        panelSearch.classList.add('hidden');
        
        // Initial render of frequent laws when switching to the library
        renderFrequentLaws();
      });
    }

    // Frequent Laws Category Dropdown Change
    const freqSelect = qs('#ilp-frequent-category-select');
    if (freqSelect) {
      freqSelect.addEventListener('change', () => {
        renderFrequentLaws();
      });
    }

    // Reset search bar when switching tabs
    function resetTextSearch() {
      const textSearchInput = qs('#ilp-in-text-search');
      if (textSearchInput) {
        textSearchInput.value = '';
      }
      const countLabel = qs('#ilp-in-text-search-count');
      if (countLabel) {
        countLabel.textContent = '0 de 0';
      }
      textMatches = [];
      currentMatchIndex = -1;
    }

    // Version selectors toggles
    qs('#ilp-btn-ver-actualizado').addEventListener('click', () => {
      if (currentTextType === 'actualizado') return;
      currentTextType = 'actualizado';
      qs('#ilp-btn-ver-actualizado').classList.add('active');
      qs('#ilp-btn-ver-completo').classList.remove('active');
      qs('#ilp-btn-comparar').classList.remove('active');
      resetTextSearch();
      renderCurrentLawText();
    });

    qs('#ilp-btn-ver-completo').addEventListener('click', () => {
      if (currentTextType === 'completo') return;
      currentTextType = 'completo';
      qs('#ilp-btn-ver-completo').classList.add('active');
      qs('#ilp-btn-ver-actualizado').classList.remove('active');
      qs('#ilp-btn-comparar').classList.remove('active');
      resetTextSearch();
      renderCurrentLawText();
    });

    qs('#ilp-btn-comparar').addEventListener('click', () => {
      if (currentTextType === 'comparar') return;
      currentTextType = 'comparar';
      qs('#ilp-btn-comparar').classList.add('active');
      qs('#ilp-btn-ver-actualizado').classList.remove('active');
      qs('#ilp-btn-ver-completo').classList.remove('active');
      resetTextSearch();
      ensureBothTextsLoadedAndRenderDiff();
    });

    // Related dropdowns
    setupDropdownToggle(qs('#ilp-btn-rel-modifica'), qs('#ilp-menu-modifica'));
    setupDropdownToggle(qs('#ilp-btn-rel-modificada-por'), qs('#ilp-menu-modificada-por'));
    setupDropdownToggle(qs('#ilp-btn-download-menu'), qs('#ilp-menu-download'));

    // Toolbar buttons
    qs('#ilp-btn-copy-full').addEventListener('click', copyFullLawText);
    qs('#ilp-btn-export-pdf').addEventListener('click', handleExportPDF);
    qs('#ilp-btn-export-docx').addEventListener('click', handleExportDOCX);
    qs('#ilp-btn-export-md').addEventListener('click', handleExportMD);
    qs('#ilp-btn-print').addEventListener('click', () => {
      window.print();
    });

    // Close active dropdowns on click outside
    document.addEventListener('click', (e) => {
      if (activeDropdown && !e.target.closest('.ilp-dropdown-container')) {
        activeDropdown.classList.add('hidden');
        activeDropdown = null;
      }
    });

    // Check if URL has query parameters to launch an immediate search or law load
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      loadLaw(idParam);
    }

    // Onboarding welcome modal for fresh installs
    if (params.get('install') === 'true') {
      const modal = qs('#ilp-onboarding-modal');
      if (modal) {
        modal.classList.remove('hidden');
        const closeBtn = qs('#ilp-onboarding-close', modal);
        const gotItBtn = qs('#ilp-onboarding-btn-gotit', modal);
        const hideModal = () => {
          modal.classList.add('hidden');
          // Clear the install parameter without reloading the page
          const url = new URL(window.location.href);
          url.searchParams.delete('install');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        };
        if (closeBtn) closeBtn.addEventListener('click', hideModal);
        if (gotItBtn) gotItBtn.addEventListener('click', hideModal);
      }
    }

    // Scroll progress bar
    const scrollWrapper = qs('#ilp-reader-content-wrapper');
    const progressBar = qs('#ilp-progress-bar');
    if (scrollWrapper && progressBar) {
      scrollWrapper.addEventListener('scroll', () => {
        const scrollTop = scrollWrapper.scrollTop;
        const scrollHeight = scrollWrapper.scrollHeight - scrollWrapper.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = `${progress}%`;
      });
    }

    // Filter TOC & Content
    const tocFilter = qs('#ilp-toc-filter');
    if (tocFilter) {
      tocFilter.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        filterReaderByToc(q);
      });
    }

    // Back-to-top wedge button: show on scroll, click → scroll to top
    const backToTopBtn = qs('#ilp-back-to-top');
    if (backToTopBtn && scrollWrapper) {
      scrollWrapper.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('visible', scrollWrapper.scrollTop > 300);
      }, { passive: true });
      backToTopBtn.addEventListener('click', () => {
        scrollWrapper.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Inline search input events
    const textSearchInput = qs('#ilp-in-text-search');
    if (textSearchInput) {
      textSearchInput.addEventListener('input', (e) => {
        performTextSearch(e.target.value);
      });
      textSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (textMatches.length > 0) {
            currentMatchIndex = (currentMatchIndex + 1) % textMatches.length;
            highlightCurrentMatch();
          }
        }
      });
    }

    const prevSearchBtn = qs('#ilp-in-text-prev');
    if (prevSearchBtn) {
      prevSearchBtn.addEventListener('click', () => {
        if (textMatches.length > 0) {
          currentMatchIndex = (currentMatchIndex - 1 + textMatches.length) % textMatches.length;
          highlightCurrentMatch();
        }
      });
    }

    const nextSearchBtn = qs('#ilp-in-text-next');
    if (nextSearchBtn) {
      nextSearchBtn.addEventListener('click', () => {
        if (textMatches.length > 0) {
          currentMatchIndex = (currentMatchIndex + 1) % textMatches.length;
          highlightCurrentMatch();
        }
      });
    }

    // Article copy delegation
    const contentArea = qs('#ilp-reader-content');
    if (contentArea) {
      contentArea.addEventListener('click', async (e) => {
        const copyBtn = e.target.closest('.ilp-art-action-btn');
        if (copyBtn) {
          const section = copyBtn.closest('.law-article');
          if (section) {
            const h3Text = section.querySelector('.law-article-header h3').textContent;
            
            // If in diff view, copy only the clean updated text (without deleted elements)
            let bodyText = '';
            const bodyEl = section.querySelector('.law-article-body');
            if (section.classList.contains('ilp-diff-deleted')) {
              bodyText = bodyEl.textContent;
            } else if (section.classList.contains('ilp-diff-modified') || section.classList.contains('ilp-diff-inserted')) {
              const clone = bodyEl.cloneNode(true);
              clone.querySelectorAll('del').forEach(el => el.remove());
              bodyText = clone.textContent;
            } else {
              bodyText = bodyEl.textContent;
            }

            const fullText = `${h3Text}\n${bodyText}`;
            try {
              await navigator.clipboard.writeText(fullText);
              const oldHtml = copyBtn.innerHTML;
              copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg>`;
              setTimeout(() => { copyBtn.innerHTML = oldHtml; }, 1200);
            } catch (err) {
              console.error('Failed to copy article text:', err);
            }
          }
        }
      });
    }

    // Render recent laws list on load
    renderRecentLaws();
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

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  }

  function cycleTheme() {
    const cur = document.body.getAttribute('data-theme') || 'light';
    const next = cur === 'light' ? 'sepia' : cur === 'sepia' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('ilp-theme', next);
  }

  // -----------------------------------------------------------------------
  // Searching Logic (GET/POST search requests direct to servicios.infoleg)
  // -----------------------------------------------------------------------
  async function handleSearch(e) {
    e.preventDefault();
    const tipo = qs('#ilp-search-tipo').value;
    const numero = qs('#ilp-search-numero').value.trim();
    const anio = qs('#ilp-search-anio').value.trim();

    if (!tipo && !numero && !anio) {
      if (ui && typeof ui.toast === 'function') {
        ui.toast('Ingresá al menos un criterio de búsqueda.', 'error');
      } else {
        alert('Ingresá al menos un criterio de búsqueda.');
      }
      return;
    }

    const listArea = qs('#ilp-results-list');
    const countArea = qs('#ilp-results-count');
    listArea.innerHTML = '<div class="ilp-loading">Buscando normas en InfoLeg...</div>';
    countArea.textContent = 'Resultados';

    try {
      const searchParams = new URLSearchParams();
      searchParams.append('tipoNorma', tipo || '');
      searchParams.append('numero', numero ? numero.replace(/\./g, '') : '');
      searchParams.append('anioSancion', anio || '');
      searchParams.append('buscar', 'Buscar');

      const res = await bgFetch('https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do', {
        method: 'POST',
        body: searchParams.toString()
      });

      // Handle direct redirect for single match result
      if (res.url && res.url.includes('verNorma.do')) {
        const m = res.url.match(/[?&]id=(\d+)/);
        if (m) {
          loadLaw(m[1]);
          listArea.innerHTML = '<div class="ilp-empty-state">La búsqueda redirigió directamente a la norma seleccionada.</div>';
          return;
        }
      }

      const buffer = await res.arrayBuffer();
      const { text: html } = decodeBuffer(buffer);
      const results = parseSearchResultsHTML(html);

      renderResultsList(results);
    } catch (err) {
      console.error('Search failed:', err);
      listArea.innerHTML = '<div class="ilp-empty-state" style="color:var(--ilp-accent);">Fallo al realizar la búsqueda. Comprobá tu conexión.</div>';
    }
  }

  function parseSearchResultsHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
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
        titulo: titulo || `Norma N° ${id}`,
        fecha,
        url: 'https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=' + id
      });
    });

    return results;
  }

  function renderResultsList(results) {
    const listArea = qs('#ilp-results-list');
    const countArea = qs('#ilp-results-count');
    listArea.innerHTML = '';

    if (!results || results.length === 0) {
      countArea.textContent = '0 resultados';
      listArea.innerHTML = '<div class="ilp-empty-state">No se encontraron normas con los criterios ingresados.</div>';
      return;
    }

    countArea.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;

    results.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'ilp-results-card';
      if (r.id === currentLawId) card.classList.add('active');

      card.innerHTML = `
        <div class="ilp-results-card-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="ilp-results-card-badge">${r.tipo} N° ${r.numero}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="ilp-results-card-date">${r.fecha}</span>
            <button class="ilp-new-tab-btn" title="Abrir en nueva pestaña">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>
        <div class="ilp-results-card-title">${r.titulo}</div>
      `;

      const newTabBtn = card.querySelector('.ilp-new-tab-btn');
      if (newTabBtn) {
        newTabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`?id=${r.id}`, '_blank');
        });
      }

      card.addEventListener('click', () => {
        qsa('.ilp-results-card', listArea).forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        loadLaw(r.id);
      });

      listArea.appendChild(card);
    });
  }

  // -----------------------------------------------------------------------
  // Reader Logic (Fetches details and HTML/text raw file, parses layout)
  // -----------------------------------------------------------------------
  async function loadLaw(id) {
    if (!id) return;
    currentLawId = id;

    // Show reader, hide welcome screen
    qs('#ilp-welcome-screen').classList.add('hidden');
    const readerPane = qs('#ilp-reader');
    readerPane.classList.remove('hidden');

    const contentArea = qs('#ilp-reader-content');
    contentArea.innerHTML = '<div class="ilp-loading">Consultando detalles de la norma...</div>';

    // Clear dropdown badges and contents
    qs('#ilp-btn-rel-modifica .badge').textContent = '0';
    qs('#ilp-btn-rel-modificada-por .badge').textContent = '0';
    qs('#ilp-menu-modifica').innerHTML = '';
    qs('#ilp-menu-modificada-por').innerHTML = '';

    try {
      const url = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${id}`;
      const res = await bgFetch(url);
      const buffer = await res.arrayBuffer();
      const { text: html } = decodeBuffer(buffer);

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

      // Safe fallback calculations
      const n = Number(id);
      const start = Math.floor(n / 5000) * 5000;
      const end = start + 4999;
      if (!originalTextUrl) {
        originalTextUrl = `https://servicios.infoleg.gob.ar/infolegInternet/anexos/${start}-${end}/${id}/norma.htm`;
      }
      if (!textUrl) {
        textUrl = `https://servicios.infoleg.gob.ar/infolegInternet/anexos/${start}-${end}/${id}/texact.htm`;
      }

      // Extract metadata
      const extractLabel = (regex) => {
        const m = html.match(regex);
        return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
      };

      let numero = extractLabel(/N[uú]mero(?:\s*de\s*Norma)?[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);
      let tipo = extractLabel(/Tipo\s*(?:de\s*Norma)?[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i) || 'Norma';
      const sancion = extractLabel(/Sanci[oó]n[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);
      const publicacion = extractLabel(/Publicaci[oó]n[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);
      const organismo = extractLabel(/Organismo\s*Emisor[\s:]*<[^>]+>([^<]+)<\/[^>]+>/i);

      // Fallback logic for tipo and numero
      if (!numero || tipo === 'Norma') {
        const strongText = doc.querySelector('#Textos_Completos strong, #resultados strong')?.textContent || '';
        if (strongText) {
          const match = strongText.match(/^\s*(Ley|Decreto-Ley|Decreto|Resolución|Disposición|Decisión\s+Administrativa|Acordada|Acuerdo|Circular|Comunicación|Código)\s+([0-9\.\/]+)/i);
          if (match) {
            if (!tipo || tipo === 'Norma') tipo = match[1].trim();
            if (!numero) numero = match[2].trim();
          }
        }
      }
      if (!numero) numero = id;

      // Fallback logic for title
      let title = doc.querySelector('.destacado')?.textContent.trim() || '';
      if (!title) {
        const titleVal = doc.querySelector('title')?.textContent.trim() || '';
        if (titleVal && !/^(infoleg)/i.test(titleVal)) {
          title = titleVal;
        }
      }
      if (!title) {
        const bTags = Array.from(doc.querySelectorAll('b, strong'));
        for (const b of bTags) {
          const txt = b.textContent.trim();
          if (txt && !/^(texto completo|texto actualizado|ver antecedentes|iniciar sesión|ir a)/i.test(txt) && txt.length > 5) {
            title = txt;
            break;
          }
        }
      }
      if (!title) {
        title = `${tipo} N° ${numero}`;
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

      // Add to recent laws history list
      addToRecentLaws(id, currentLawMeta);

      // Set reader metadata in toolbar
      qs('#ilp-reader-law-type').textContent = tipo;
      qs('#ilp-reader-law-num').textContent = `N° ${numero}`;

      const openOriginalBtn = qs('#ilp-btn-open-original');
      if (openOriginalBtn) {
        openOriginalBtn.setAttribute('href', `${url}&ilp-bypass=true`);
      }

      // Force reset view mode to updated text when opening a new law
      currentTextType = 'actualizado';
      const btnActualizado = qs('#ilp-btn-ver-actualizado');
      const btnCompleto = qs('#ilp-btn-ver-completo');
      const btnComparar = qs('#ilp-btn-comparar');
      if (btnActualizado) btnActualizado.classList.add('active');
      if (btnCompleto) btnCompleto.classList.remove('active');
      if (btnComparar) btnComparar.classList.remove('active');

      // Reset text states and query bodies
      currentLawData = {};
      await fetchAndParseText(textUrl, originalTextUrl);

      // Async fetch relationships links (vinculos)
      fetchLawRelationships(id);
    } catch (err) {
      console.error('Error loading law details:', err);
      contentArea.innerHTML = '<div class="ilp-loading" style="color:var(--ilp-accent);">Error al cargar los detalles de esta norma. Por favor, reintente.</div>';
    }
  }

  async function fetchAndParseText(updatedUrl, originalUrl) {
    const contentArea = qs('#ilp-reader-content');
    contentArea.innerHTML = '<div class="ilp-loading">Descargando y formateando texto normativo...</div>';

    const targetUrl = currentTextType === 'actualizado' ? updatedUrl : originalUrl;

    try {
      const res = await bgFetch(targetUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const buffer = await res.arrayBuffer();
      const { text: rawHtml } = decodeBuffer(buffer);

      const cleanRaw = htmlToText(rawHtml, targetUrl);
      if (cleanRaw.length < 60 || /no se pudo acceder al archivo solicitado/i.test(rawHtml)) {
        throw new Error('Contenido no usable');
      }
      currentLawData[currentTextType] = parser.parseLawText(cleanRaw);

      renderCurrentLawText();
    } catch (err) {
      console.warn(`Error loading text for type ${currentTextType}:`, err);
      
      // Fallback automatically to complete/original text if actualizado failed
      if (currentTextType === 'actualizado') {
        currentTextType = 'completo';
        const completoBtn = qs('#ilp-btn-ver-completo');
        const actualizadoBtn = qs('#ilp-btn-ver-actualizado');
        if (completoBtn) completoBtn.classList.add('active');
        if (actualizadoBtn) actualizadoBtn.classList.remove('active');
        return fetchAndParseText(updatedUrl, originalUrl);
      }

      console.warn('Fallback to verNorma parsing due to file loading issue:', err);
      try {
        const fallbackUrl = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${currentLawId}`;
        const res = await bgFetch(fallbackUrl);
        const buffer = await res.arrayBuffer();
        const { text: html } = decodeBuffer(buffer);
        const textClean = htmlToText(html, fallbackUrl);
        currentLawData[currentTextType] = parser.parseLawText(textClean);
        renderCurrentLawText();
      } catch (innerErr) {
        contentArea.innerHTML = '<div class="ilp-loading" style="color:var(--ilp-accent);">No se pudo cargar el cuerpo del texto para esta norma. El archivo podría no estar digitalizado en InfoLeg.</div>';
      }
    }
  }

  let activeObserver = null;

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

    // Heurística conservadora: solo líneas cortas (≤50 chars) que parecen títulos.
    // Los títulos provenientes de <b>/<i> ya llegan como [ILP-TITLE] y son manejados antes.
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
        // Marcador de salto de párrafo: produce línea vacía → doble <br/> al unir
        if (line.trim() === '[ILP-PARA]') return '';
        // Marcador de título proveniente de negrita/cursiva en el HTML original
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
    if (currentTextType === 'comparar') {
      renderDiffText();
      return;
    }
    const contentArea = qs('#ilp-reader-content');
    const tocList = qs('#ilp-toc-list');
    const data = currentLawData[currentTextType];
    const meta = currentLawMeta;

    if (!data) {
      const textUrl = meta?.textUrl || '';
      const originalTextUrl = meta?.originalTextUrl || '';
      fetchAndParseText(textUrl, originalTextUrl);
      return;
    }

    // Clear previous observer
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    // Reset filter input
    const filterInput = qs('#ilp-toc-filter');
    if (filterInput) filterInput.value = '';

    // Clear content & TOC
    contentArea.innerHTML = '';
    tocList.innerHTML = '';

    // Render Title
    const titleEl = document.createElement('h1');
    titleEl.textContent = meta.titulo || data.title;
    contentArea.appendChild(titleEl);

    // Render Metadata subtitle
    if (meta.sancion || meta.publicacion || meta.organismo) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'ilp-law-meta-subtitle';
      if (meta.organismo) {
        metaDiv.innerHTML += `<span><strong>Organismo:</strong> ${meta.organismo}</span>`;
      }
      if (meta.sancion) {
        metaDiv.innerHTML += `<span><strong>Sancionada:</strong> ${meta.sancion}</span>`;
      }
      if (meta.publicacion) {
        metaDiv.innerHTML += `<span><strong>Publicada:</strong> ${meta.publicacion}</span>`;
      }
      contentArea.appendChild(metaDiv);
    }

    // Body wrapper
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'ilp-law-body-wrapper';
    contentArea.appendChild(bodyWrapper);

    // Preamble
    if (data.preamble) {
      const preambleDiv = document.createElement('div');
      preambleDiv.className = 'ilp-preamble';
      data.preamble.split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.textContent = para.trim();
          preambleDiv.appendChild(p);
        }
      });
      bodyWrapper.appendChild(preambleDiv);
    }

    // Articles & TOC
    if (data.articles && data.articles.length > 0) {
      const tocFrag = document.createDocumentFragment();
      const bodyFrag = document.createDocumentFragment();

      data.articles.forEach((art, idx) => {
        // Add to TOC List
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'ilp-toc-link';
        a.dataset.target = `ilp-art-${idx}`;
        a.textContent = art.prefix.trim() || `Art. ${art.num}`;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const targetEl = document.getElementById(`ilp-art-${idx}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            qsa('.ilp-toc-link').forEach((link) => link.classList.remove('active'));
            a.classList.add('active');
          }
        });
        li.appendChild(a);
        tocFrag.appendChild(li);

        // Render headers before article
        if (art.headers && art.headers.length > 0) {
          art.headers.forEach((h) => {
            if (h === '[ILP-PARA]') return;
            const displayH = parser.unwrapTitleMarker(h);
            if (parser.isStructuralHeader(displayH)) {
              const h2 = document.createElement('div');
              h2.className = 'ilp-structural-header';
              h2.textContent = displayH;
              bodyFrag.appendChild(h2);
            } else {
              const h3 = document.createElement('div');
              h3.className = 'ilp-article-subtitle';
              h3.textContent = displayH;
              bodyFrag.appendChild(h3);
            }
          });
        }

        // Render Article Card
        const section = document.createElement('section');
        section.id = `ilp-art-${idx}`;
        section.className = 'law-article';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'law-article-header';

        const h3 = document.createElement('h3');
        h3.style.margin = '0';
        h3.textContent = art.prefix;
        headerDiv.appendChild(h3);

        const copyArtBtn = document.createElement('button');
        copyArtBtn.className = 'ilp-art-action-btn';
        copyArtBtn.title = 'Copiar artículo';
        copyArtBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        headerDiv.appendChild(copyArtBtn);
        section.appendChild(headerDiv);

        const bodyP = document.createElement('p');
        bodyP.className = 'law-article-body';
        bodyP.innerHTML = formatTextWithImages(art.text);
        section.appendChild(bodyP);

        bodyFrag.appendChild(section);
      });

      tocList.appendChild(tocFrag);
      bodyWrapper.appendChild(bodyFrag);

      // Initialize Scroll-Spy IntersectionObserver
      const scrollWrapper = qs('#ilp-reader-content-wrapper');
      const navLinks = Array.from(tocList.querySelectorAll('.ilp-toc-link'));
      
      activeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeId = entry.target.id;
            navLinks.forEach((link) => {
              const isActive = link.dataset.target === activeId;
              link.classList.toggle('active', isActive);
              if (isActive) {
                const linkRect = link.getBoundingClientRect();
                const sidebarRect = tocList.getBoundingClientRect();
                if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
                  link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              }
            });
          }
        });
      }, { root: scrollWrapper, rootMargin: '-10% 0px -75% 0px', threshold: 0 });

      qsa('.law-article', bodyWrapper).forEach((art) => activeObserver.observe(art));

    } else {
      // Just render preamble or plain text
      const plainDiv = document.createElement('div');
      plainDiv.className = 'ilp-plain-body';
      (data.preamble || '').split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.textContent = para.trim();
          plainDiv.appendChild(p);
        }
      });
      bodyWrapper.appendChild(plainDiv);
    }

    // Render Footer / Signatures
    if (data.footer) {
      const footerDiv = document.createElement('div');
      footerDiv.className = 'ilp-law-footer-notes';
      data.footer.split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.textContent = para.trim();
          footerDiv.appendChild(p);
        }
      });
      contentArea.appendChild(footerDiv);
    }

    // Scroll content panel to top
    const contentScroll = qs('#ilp-reader-content-wrapper');
    if (contentScroll) contentScroll.scrollTop = 0;
    
    // Reset progress bar
    const progressBar = qs('#ilp-progress-bar');
    if (progressBar) progressBar.style.width = '0%';

    applyReaderSettings();
  }

  // -----------------------------------------------------------------------
  // Relationships Scraping (verVinculos.do)
  // -----------------------------------------------------------------------
  async function fetchLawRelationships(id) {
    loadRelationshipMode(id, 1, qs('#ilp-btn-rel-modifica'), qs('#ilp-menu-modifica'));
    loadRelationshipMode(id, 2, qs('#ilp-btn-rel-modificada-por'), qs('#ilp-menu-modificada-por'));
  }

  async function loadRelationshipMode(id, modo, btn, menu) {
    try {
      const res = await bgFetch(`https://servicios.infoleg.gob.ar/infolegInternet/verVinculos.do?modo=${modo}&id=${id}`);
      if (!res.ok) return;

      const buffer = await res.arrayBuffer();
      const { text: html } = decodeBuffer(buffer);

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
          loadLaw(v.id);
        });
        menu.appendChild(item);
      });
    } catch (err) {
      console.warn(`Failed loading relationships mode ${modo}:`, err);
    }
  }

  function parseVinculosHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
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
        const tipo = leftText.match(/^(Ley|Decreto|Resoluci[oó]n|Disposici[oó]n|Decisi[oó]n\s+Administrativa|Acordada|Acta|Acuerdo|Circular|Comunicaci[oó]n|Decreto\/Ley)/i)?.[1] || 'Norma';
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
  // Actions: Copy Citation, Export PDF, Export DOCX
  // -----------------------------------------------------------------------
  async function copyCiteToClipboard() {
    if (!currentLawMeta) return;
    const meta = currentLawMeta;
    const typeLabel = currentTextType === 'actualizado' ? 'Texto Actualizado' : 'Texto Original';
    const citation = `${meta.tipo} N° ${meta.numero} (B.O. ${meta.publicacion || 'N/D'}) - ${meta.titulo}. Enlace oficial: ${meta.url} (${typeLabel})`;
    
    try {
      await navigator.clipboard.writeText(citation);
      if (ui && typeof ui.toast === 'function') {
        ui.toast('Cita oficial copiada al portapapeles.');
      } else {
        alert('Cita oficial copiada al portapapeles.');
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

      chrome.runtime.sendMessage({ action: 'exportPDF', lawData }, (response) => {
        if (response && response.success && response.dataUri) {
          const a = document.createElement('a');
          a.href = response.dataUri;
          a.download = `${currentLawMeta.tipo}_${currentLawMeta.numero}.pdf`.replace(/\s+/g, '_');
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          throw new Error(response ? response.error : 'Respuesta vacía del Service Worker');
        }
      });
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      alert('Error al exportar PDF: ' + err.message);
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
        } else {
          throw new Error(response ? response.error : 'Respuesta vacía del Service Worker');
        }
      });
    } catch (err) {
      console.error('Error al exportar DOCX:', err);
      alert('Error al exportar Word: ' + err.message);
    }
  }

  async function handleExportMD() {
    const data = currentLawData[currentTextType];
    if (!data) return;
    try {
      const title = currentLawMeta.titulo || data.title;
      let md = `# ${title}\n\n`;
      if (data.preamble) {
        md += `## Preámbulo\n\n`;
        data.preamble.split('\n\n').forEach(para => {
          if (para.trim()) md += `> ${para.trim().replace(/\n/g, '\n> ')}\n\n`;
        });
      }
      if (data.articles && data.articles.length > 0) {
        md += `## Articulado\n\n`;
        data.articles.forEach(art => {
          if (art.headers && art.headers.length > 0) {
            art.headers.forEach(header => {
              const isStruct = /^(LIBRO|PARTE|TITULO|TÍTULO|CAPITULO|CAPÍTULO|SECCION|SECCIÓN|DISPOSICI[OÓ]N)/i.test(header.trim());
              md += isStruct ? `## ${header.trim()}\n\n` : `*${header.trim()}*\n\n`;
            });
          }
          
          let artBody = '';
          if (art.text) {
            artBody = art.text.split('\n').map(line => {
              const trimmed = line.trim();
              if (!trimmed) return '';
              const listMatch = trimmed.match(/^([a-z0-9I|V|X]+[\)\.\-]{1,2})\s+(.*)/i);
              return listMatch ? `* **${listMatch[1]}** ${listMatch[2]}` : trimmed;
            }).filter(l => l.length > 0).join('\n\n');
          }
          
          md += `### ${art.prefix.trim()}\n\n${artBody}\n\n`;
        });
      }
      if (data.footer) {
        md += `---\n\n### Firmantes / Pie de Norma\n\n`;
        data.footer.split('\n\n').forEach(para => {
          if (para.trim()) md += `*${para.trim()}*\n\n`;
        });
      }

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentLawMeta.tipo}_${currentLawMeta.numero}.md`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar MD:', err);
      alert('Error al exportar Markdown: ' + err.message);
    }
  }

  // -----------------------------------------------------------------------
  // Reform comparison (Diff) & Word alignment
  // -----------------------------------------------------------------------
  async function ensureBothTextsLoadedAndRenderDiff() {
    const contentArea = qs('#ilp-reader-content');
    contentArea.innerHTML = '<div class="ilp-loading">Cargando versiones para comparar...</div>';
    
    try {
      const meta = currentLawMeta;
      if (!meta) return;

      // Fetch actualizado if missing
      if (!currentLawData['actualizado']) {
        const res = await bgFetch(meta.textUrl);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const { text: rawHtml } = decodeBuffer(buffer);
          const cleanRaw = htmlToText(rawHtml, meta.textUrl);
          if (cleanRaw.length >= 60 && !/no se pudo acceder al archivo solicitado/i.test(rawHtml)) {
            currentLawData['actualizado'] = parser.parseLawText(cleanRaw);
          }
        }
      }

      // Fetch completo if missing
      if (!currentLawData['completo']) {
        const res = await bgFetch(meta.originalTextUrl);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const { text: rawHtml } = decodeBuffer(buffer);
          const cleanRaw = htmlToText(rawHtml, meta.originalTextUrl);
          if (cleanRaw.length >= 60 && !/no se pudo acceder al archivo solicitado/i.test(rawHtml)) {
            currentLawData['completo'] = parser.parseLawText(cleanRaw);
          }
        }
      }

      // If still missing (e.g. fallback or errors), try parsing from verNorma direct text
      if (!currentLawData['actualizado'] || !currentLawData['completo']) {
        const fallbackUrl = `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=${currentLawId}`;
        const res = await bgFetch(fallbackUrl);
        const buffer = await res.arrayBuffer();
        const { text: html } = decodeBuffer(buffer);
        const textClean = htmlToText(html, fallbackUrl);
        const parsed = parser.parseLawText(textClean);
        if (!currentLawData['actualizado']) currentLawData['actualizado'] = parsed;
        if (!currentLawData['completo']) currentLawData['completo'] = parsed;
      }

      renderCurrentLawText();
    } catch (err) {
      console.error('Error loading texts for diff:', err);
      contentArea.innerHTML = '<div class="ilp-loading" style="color:var(--ilp-accent);">No se pudieron cargar ambas versiones para realizar la comparación.</div>';
    }
  }

  function alignArticles(oldArts, newArts) {
    const N1 = oldArts.length;
    const N2 = newArts.length;
    const dp = Array(N1 + 1).fill(0).map(() => Array(N2 + 1).fill(0));

    for (let i = 1; i <= N1; i++) {
      for (let j = 1; j <= N2; j++) {
        if (oldArts[i - 1].num.toLowerCase().trim() === newArts[j - 1].num.toLowerCase().trim()) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = N1;
    let j = N2;
    const aligned = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldArts[i - 1].num.toLowerCase().trim() === newArts[j - 1].num.toLowerCase().trim()) {
        aligned.push({
          type: 'both',
          old: oldArts[i - 1],
          new: newArts[j - 1],
          num: newArts[j - 1].num
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        aligned.push({
          type: 'inserted',
          new: newArts[j - 1],
          num: newArts[j - 1].num
        });
        j--;
      } else {
        aligned.push({
          type: 'deleted',
          old: oldArts[i - 1],
          num: oldArts[i - 1].num
        });
        i--;
      }
    }

    return aligned.reverse();
  }

  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function diffWords(oldText, newText) {
    const escOld = escapeHtml(oldText);
    const escNew = escapeHtml(newText);
    
    const oldWords = escOld.split(/(\s+)/);
    const newWords = escNew.split(/(\s+)/);
    
    const dp = Array(oldWords.length + 1).fill(0).map(() => Array(newWords.length + 1).fill(0));
    
    for (let i = 1; i <= oldWords.length; i++) {
      for (let j = 1; j <= newWords.length; j++) {
        if (oldWords[i - 1] === newWords[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    let i = oldWords.length;
    let j = newWords.length;
    const result = [];
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
        result.push(oldWords[i - 1]);
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        const word = newWords[j - 1];
        if (word.trim()) {
          result.push(`<ins class="ilp-diff-ins">${word}</ins>`);
        } else {
          result.push(word);
        }
        j--;
      } else {
        const word = oldWords[i - 1];
        if (word.trim()) {
          result.push(`<del class="ilp-diff-del">${word}</del>`);
        } else {
          result.push(word);
        }
        i--;
      }
    }
    
    return result.reverse().join('');
  }

  function renderDiffText() {
    const contentArea = qs('#ilp-reader-content');
    const tocList = qs('#ilp-toc-list');
    const dataOld = currentLawData['completo'];
    const dataNew = currentLawData['actualizado'];
    const meta = currentLawMeta;

    if (!dataOld || !dataNew) return;

    // Reset filter input
    const filterInput = qs('#ilp-toc-filter');
    if (filterInput) filterInput.value = '';

    // Clear content & TOC
    contentArea.innerHTML = '';
    tocList.innerHTML = '';

    // Render Title Diff
    const titleEl = document.createElement('h1');
    if (dataOld.title !== dataNew.title) {
      titleEl.innerHTML = diffWords(dataOld.title, dataNew.title);
    } else {
      titleEl.textContent = meta.titulo || dataNew.title;
    }
    contentArea.appendChild(titleEl);

    // Render Metadata subtitle
    if (meta.sancion || meta.publicacion || meta.organismo) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'ilp-law-meta-subtitle';
      if (meta.organismo) {
        metaDiv.innerHTML += `<span><strong>Organismo:</strong> ${meta.organismo}</span>`;
      }
      if (meta.sancion) {
        metaDiv.innerHTML += `<span><strong>Sancionada:</strong> ${meta.sancion}</span>`;
      }
      if (meta.publicacion) {
        metaDiv.innerHTML += `<span><strong>Publicada:</strong> ${meta.publicacion}</span>`;
      }
      contentArea.appendChild(metaDiv);
    }

    // Body wrapper
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'ilp-law-body-wrapper ilp-diff-view';
    contentArea.appendChild(bodyWrapper);

    // Diff Preamble
    if (dataOld.preamble || dataNew.preamble) {
      const preambleDiv = document.createElement('div');
      preambleDiv.className = 'ilp-preamble';
      
      const diffPreamble = diffWords(dataOld.preamble || '', dataNew.preamble || '');
      diffPreamble.split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.innerHTML = para.trim();
          preambleDiv.appendChild(p);
        }
      });
      bodyWrapper.appendChild(preambleDiv);
    }

    // Articles Alignment and Diff
    const alignedArts = alignArticles(dataOld.articles || [], dataNew.articles || []);
    
    if (alignedArts.length > 0) {
      const tocFrag = document.createDocumentFragment();
      const bodyFrag = document.createDocumentFragment();

      alignedArts.forEach((aligned, idx) => {
        // Add to TOC List
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'ilp-toc-link';
        a.dataset.target = `ilp-art-${idx}`;
        a.textContent = aligned.type === 'deleted' 
          ? (aligned.old.prefix.trim() || `Art. ${aligned.num}`)
          : (aligned.new.prefix.trim() || `Art. ${aligned.num}`);

        // Add class to TOC depending on status
        if (aligned.type === 'inserted') {
          a.classList.add('ilp-toc-diff-inserted');
        } else if (aligned.type === 'deleted') {
          a.classList.add('ilp-toc-diff-deleted');
        } else if (aligned.type === 'both' && aligned.old.text !== aligned.new.text) {
          a.classList.add('ilp-toc-diff-modified');
        }

        a.addEventListener('click', (e) => {
          e.preventDefault();
          const targetEl = document.getElementById(`ilp-art-${idx}`);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            qsa('.ilp-toc-link').forEach((link) => link.classList.remove('active'));
            a.classList.add('active');
          }
        });
        li.appendChild(a);
        tocFrag.appendChild(li);

        // Render headers before article
        const artHeaders = aligned.type === 'deleted' ? aligned.old.headers : aligned.new.headers;
        if (artHeaders && artHeaders.length > 0) {
          artHeaders.forEach((h) => {
            if (parser.isStructuralHeader(h)) {
              const h2 = document.createElement('div');
              h2.className = 'ilp-structural-header';
              h2.textContent = h;
              bodyFrag.appendChild(h2);
            } else {
              const h3 = document.createElement('div');
              h3.className = 'ilp-article-subtitle';
              h3.textContent = h;
              bodyFrag.appendChild(h3);
            }
          });
        }

        // Render Article Card
        const section = document.createElement('section');
        section.id = `ilp-art-${idx}`;
        section.className = 'law-article';

        // Add diff status classes
        if (aligned.type === 'inserted') {
          section.classList.add('ilp-diff-inserted');
        } else if (aligned.type === 'deleted') {
          section.classList.add('ilp-diff-deleted');
        } else if (aligned.type === 'both' && aligned.old.text !== aligned.new.text) {
          section.classList.add('ilp-diff-modified');
        }

        const headerDiv = document.createElement('div');
        headerDiv.className = 'law-article-header';

        const h3 = document.createElement('h3');
        h3.style.margin = '0';
        
        if (aligned.type === 'both') {
          if (aligned.old.prefix !== aligned.new.prefix) {
            h3.innerHTML = diffWords(aligned.old.prefix, aligned.new.prefix);
          } else {
            h3.textContent = aligned.new.prefix;
          }
        } else if (aligned.type === 'inserted') {
          h3.innerHTML = `<ins class="ilp-diff-ins">${escapeHtml(aligned.new.prefix)}</ins>`;
        } else {
          h3.innerHTML = `<del class="ilp-diff-del">${escapeHtml(aligned.old.prefix)}</del>`;
        }
        headerDiv.appendChild(h3);

        const copyArtBtn = document.createElement('button');
        copyArtBtn.className = 'ilp-art-action-btn';
        copyArtBtn.title = 'Copiar artículo';
        copyArtBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        headerDiv.appendChild(copyArtBtn);
        section.appendChild(headerDiv);

        const bodyP = document.createElement('p');
        bodyP.className = 'law-article-body';
        
        if (aligned.type === 'both') {
          if (aligned.old.text !== aligned.new.text) {
            bodyP.innerHTML = diffWords(aligned.old.text, aligned.new.text);
          } else {
            bodyP.textContent = aligned.new.text;
          }
        } else if (aligned.type === 'inserted') {
          bodyP.innerHTML = `<ins class="ilp-diff-ins">${escapeHtml(aligned.new.text)}</ins>`;
        } else {
          bodyP.innerHTML = `<del class="ilp-diff-del">${escapeHtml(aligned.old.text)}</del>`;
        }
        
        section.appendChild(bodyP);
        bodyFrag.appendChild(section);
      });

      tocList.appendChild(tocFrag);
      bodyWrapper.appendChild(bodyFrag);

      // Scroll-spy observer
      const scrollWrapper = qs('#ilp-reader-content-wrapper');
      const navLinks = Array.from(tocList.querySelectorAll('.ilp-toc-link'));
      
      activeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeId = entry.target.id;
            navLinks.forEach((link) => {
              const isActive = link.dataset.target === activeId;
              link.classList.toggle('active', isActive);
              if (isActive) {
                const linkRect = link.getBoundingClientRect();
                const sidebarRect = tocList.getBoundingClientRect();
                if (linkRect.top < sidebarRect.top || linkRect.bottom > sidebarRect.bottom) {
                  link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
              }
            });
          }
        });
      }, { root: scrollWrapper, rootMargin: '-10% 0px -75% 0px', threshold: 0 });

      qsa('.law-article', bodyWrapper).forEach((art) => activeObserver.observe(art));

    } else {
      // Plain text diff
      const plainDiv = document.createElement('div');
      plainDiv.className = 'ilp-plain-body';
      
      const diffBody = diffWords(dataOld.preamble || '', dataNew.preamble || '');
      diffBody.split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.innerHTML = para.trim();
          plainDiv.appendChild(p);
        }
      });
      bodyWrapper.appendChild(plainDiv);
    }

    // Render Footer Diff
    if (dataOld.footer || dataNew.footer) {
      const footerDiv = document.createElement('div');
      footerDiv.className = 'ilp-law-footer-notes';
      const diffFooter = diffWords(dataOld.footer || '', dataNew.footer || '');
      diffFooter.split('\n\n').forEach((para) => {
        if (para.trim()) {
          const p = document.createElement('p');
          p.innerHTML = para.trim();
          footerDiv.appendChild(p);
        }
      });
      contentArea.appendChild(footerDiv);
    }

    // Scroll content panel to top
    const contentScroll = qs('#ilp-reader-content-wrapper');
    if (contentScroll) contentScroll.scrollTop = 0;
    
    // Reset progress bar
    const progressBar = qs('#ilp-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
  }

  // -----------------------------------------------------------------------
  // Copy Full Law Text
  // -----------------------------------------------------------------------
  async function copyFullLawText() {
    let type = currentTextType;
    if (type === 'comparar') {
      type = 'actualizado'; // Copy the updated version by default when in diff view
    }
    const data = currentLawData[type];
    const meta = currentLawMeta;
    if (!data || !meta) return;

    const strip = (ILP.parser && ILP.parser.stripMarkers) || ((t) => t);

    let fullText = '';

    // Add title
    fullText += `${meta.titulo || data.title}\n`;

    // Add metadata subtitle
    const metaParts = [];
    if (meta.organismo) metaParts.push(`Organismo: ${meta.organismo}`);
    if (meta.sancion) metaParts.push(`Sancionada: ${meta.sancion}`);
    if (meta.publicacion) metaParts.push(`Publicada: ${meta.publicacion}`);
    if (metaParts.length > 0) {
      fullText += `${metaParts.join(' | ')}\n`;
    }
    fullText += '\n';

    // Add preamble
    if (data.preamble) {
      fullText += `${strip(data.preamble)}\n\n`;
    }

    // Add articles
    if (data.articles && data.articles.length > 0) {
      data.articles.forEach((art) => {
        if (art.headers && art.headers.length > 0) {
          art.headers.forEach((h) => {
            const clean = strip(h);
            if (clean) fullText += `${clean}\n`;
          });
        }
        const cleanPrefix = strip(art.prefix);
        const cleanText = strip(art.text);
        fullText += `${cleanPrefix}\n${cleanText}\n\n`;
      });
    } else if (data.plainText) {
      fullText += `${strip(data.plainText)}\n\n`;
    }

    // Add footer
    if (data.footer) {
      fullText += `${strip(data.footer)}\n`;
    }

    try {
      await navigator.clipboard.writeText(fullText.trim());
      
      // Visual feedback
      const copyBtn = qs('#ilp-btn-copy-full');
      const oldHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ilp-btn-svg"><polyline points="20 6 9 17 4 12"/></svg><span>¡Copiada!</span>`;
      setTimeout(() => { copyBtn.innerHTML = oldHtml; }, 1500);
    } catch (err) {
      console.error('Failed to copy full law text:', err);
      alert('Error al copiar el texto completo.');
    }
  }

  // -----------------------------------------------------------------------
  // Text Search & Highlight
  // -----------------------------------------------------------------------
  function clearSearchHighlights(container) {
    if (!container) return;
    qsa('mark.ilp-text-match', container).forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      }
    });
  }

  function highlightCurrentMatch() {
    textMatches.forEach((match) => match.classList.remove('current-match'));
    const countLabel = qs('#ilp-in-text-search-count');
    
    if (currentMatchIndex >= 0 && currentMatchIndex < textMatches.length) {
      const activeMatch = textMatches[currentMatchIndex];
      activeMatch.classList.add('current-match');
      
      activeMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      if (countLabel) {
        countLabel.textContent = `${currentMatchIndex + 1} de ${textMatches.length}`;
      }
    } else {
      if (countLabel) {
        countLabel.textContent = `0 de ${textMatches.length}`;
      }
    }
  }

  function performTextSearch(query) {
    const container = qs('#ilp-reader-content');
    if (!container) return;

    clearSearchHighlights(container);
    textMatches = [];
    currentMatchIndex = -1;

    const countLabel = qs('#ilp-in-text-search-count');

    if (!query || query.trim().length < 2) {
      if (countLabel) countLabel.textContent = '0 de 0';
      return;
    }

    const escaped = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.ilp-art-action-btn') || 
            parent.closest('.ilp-dropdown-container') ||
            parent.tagName === 'MARK' || 
            parent.tagName === 'SCRIPT' || 
            parent.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return regex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodesToReplace = [];
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      nodesToReplace.push(currentNode);
    }

    nodesToReplace.forEach((node) => {
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      node.nodeValue.replace(regex, (match, p1, offset) => {
        frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIdx, offset)));
        const mark = document.createElement('mark');
        mark.className = 'ilp-text-match';
        mark.textContent = match;
        frag.appendChild(mark);
        lastIdx = offset + match.length;
      });
      frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIdx)));
      if (node.parentNode) {
        node.parentNode.replaceChild(frag, node);
      }
    });

    textMatches = qsa('mark.ilp-text-match', container);

    if (textMatches.length > 0) {
      currentMatchIndex = 0;
      highlightCurrentMatch();
    } else {
      if (countLabel) countLabel.textContent = '0 de 0';
    }
  }

  function filterReaderByToc(q) {
    const items = qsa('#ilp-toc-list li');
    const articles = qsa('.law-article');
    const headers = qsa('.ilp-structural-header, .ilp-article-subtitle');

    if (!q) {
      items.forEach((li) => li.style.display = '');
      articles.forEach((art) => art.style.display = '');
      headers.forEach((h) => h.style.display = '');
      return;
    }

    items.forEach((li) => {
      const match = li.textContent.toLowerCase().includes(q);
      li.style.display = match ? '' : 'none';
    });

    articles.forEach((art) => {
      const prefix = art.querySelector('.law-article-header h3')?.textContent.toLowerCase() || '';
      const body = art.querySelector('.law-article-body')?.textContent.toLowerCase() || '';
      const match = prefix.includes(q) || body.includes(q);
      art.style.display = match ? '' : 'none';
    });
    
    headers.forEach((h) => h.style.display = 'none');
  }

  // Storing & rendering of recently opened laws
  function addToRecentLaws(id, metadata) {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('ilp-recent-laws')) || [];
    } catch (_) {}

    list = list.filter(item => item.id !== id);

    list.unshift({
      id: id,
      tipo: metadata.tipo,
      numero: metadata.numero,
      titulo: metadata.titulo || `Norma N° ${metadata.numero}`
    });

    if (list.length > 8) {
      list = list.slice(0, 8);
    }

    try {
      localStorage.setItem('ilp-recent-laws', JSON.stringify(list));
    } catch (_) {}

    renderRecentLaws();
  }

  function renderRecentLaws() {
    const container = qs('#ilp-recent-list');
    if (!container) return;

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('ilp-recent-laws')) || [];
    } catch (_) {}

    if (list.length === 0) {
      container.innerHTML = '<div class="ilp-empty-state" style="padding:20px 0; font-size: 0.8rem;">No hay normas vistas recientemente.</div>';
      renderFrequentLaws();
      return;
    }

    container.innerHTML = '';
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'ilp-results-card';
      card.style.padding = '10px 14px';
      card.style.gap = '4px';
      card.style.cursor = 'pointer';
      
      if (item.id === currentLawId) {
        card.classList.add('active');
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="ilp-results-card-badge" style="font-size:0.62rem; padding:1px 6px;">${item.tipo}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size:0.68rem; color:var(--ilp-text-2); font-weight:500;">N° ${item.numero}</span>
            <button class="ilp-new-tab-btn" title="Abrir en nueva pestaña">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>
        <div style="font-size:0.78rem; font-weight:600; line-height:1.3; color:var(--ilp-text-0); text-overflow:ellipsis; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-top:4px;">
          ${item.titulo}
        </div>
      `;

      const newTabBtn = card.querySelector('.ilp-new-tab-btn');
      if (newTabBtn) {
        newTabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`?id=${item.id}`, '_blank');
        });
      }

      card.addEventListener('click', () => {
        if (item.id !== currentLawId) {
          loadLaw(item.id);
        }
      });

      container.appendChild(card);
    });

    renderFrequentLaws();
  }

  function renderFrequentLaws() {
    const container = qs('#ilp-frequent-list');
    const select = qs('#ilp-frequent-category-select');
    if (!container || !select) return;

    const category = select.value;
    const list = FREQUENT_LAWS[category] || [];

    if (list.length === 0) {
      container.innerHTML = '<div class="ilp-empty-state" style="padding:10px 0; font-size: 0.8rem;">No hay normas en esta categoría.</div>';
      return;
    }

    container.innerHTML = '';
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'ilp-results-card';
      card.style.padding = '10px 14px';
      card.style.gap = '4px';
      card.style.cursor = 'pointer';
      
      if (item.id === currentLawId) {
        card.classList.add('active');
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="ilp-results-card-badge" style="font-size:0.62rem; padding:1px 6px;">${item.tipo}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size:0.68rem; color:var(--ilp-text-2); font-weight:500;">N° ${item.numero}</span>
            <button class="ilp-new-tab-btn" title="Abrir en nueva pestaña">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>
        <div style="font-size:0.78rem; font-weight:600; line-height:1.3; color:var(--ilp-text-0); text-overflow:ellipsis; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-top:4px;">
          ${item.titulo}
        </div>
      `;

      const newTabBtn = card.querySelector('.ilp-new-tab-btn');
      if (newTabBtn) {
        newTabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`?id=${item.id}`, '_blank');
        });
      }

      card.addEventListener('click', () => {
        if (item.id !== currentLawId) {
          loadLaw(item.id);
        }
      });

      container.appendChild(card);
    });
  }

  // Trigger init on DOM Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
