# Leyes-Plus Argentina

> Capa moderna de navegación, búsqueda y lectura sobre [infoleg.gob.ar](https://www.infoleg.gob.ar/).

Leyes-Plus Argentina es una extensión Chrome (MV3) que **no reemplaza el sitio oficial del Ministerio de Justicia**: lo envuelve con un shell moderno, oculta la UI heredada (WordPress Twenty Eleven / Copyright 2005), y entrega un workspace de investigación jurídica con:

- **Reader de norma** (MVP1): parsea `verNorma.do`, trae el texto crudo con detección de encoding (windows-1252 ↔ utf-8), arma índice de artículos, scroll-spy, búsqueda in-text, temas claro/sepia/oscuro, tipografía y tamaño variables, export a PDF / DOCX / Markdown.
- **Portal de búsqueda** (MVP2): shell 2 columnas con sidebar de búsqueda (tabs Por norma / Por texto / Por BO / Por organismo) y panel derecho con un `<iframe>` viewer. La búsqueda se postea por form al iframe (sin CORS); los resultados de InfoLeg se renderizan dentro del panel derecho; al hacer click en un resultado, la ficha se carga en el mismo iframe. El home inicial es un `srcdoc` con cards de normas destacadas que navegan por `postMessage`.
- **Side panel, productividad, explorer temático** (MVP3 / MVP4): favoritos, historial, atajos, omnibox keyword.

## Arquitectura clave: iframe viewer + srcdoc home

- **El panel derecho del portal es un `<iframe name="ilp-viewer">`.** El form de búsqueda postea con `target=ilp-viewer` a `https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do`. Esto evita CORS cross-origin: el navegador hace un POST cross-origin pero la respuesta se carga en el iframe del mismo origen que la página.
- **El home inicial se renderiza como `srcdoc`** (mismo origen que el parent, no requiere fetch) con cards de normas destacadas. Cada card hace `parent.postMessage({type:'ilp:navigate', url}, '*')` y el parent actualiza `viewerIframe.src`.
- **Cuando el usuario hace click en un resultado, la URL navega a `verNorma.do`** dentro del iframe. Como el manifest tiene `all_frames: true` para el reader, el content script del reader se inyecta también dentro del iframe.
- **El reader detecta que está embebido** (`window.parent.document.getElementById('ilp-portal-root')` existe) y aplica clase `.ilp-iframe-mode` al root. El CSS esconde el sidebar izquierdo de búsqueda (el padre ya lo tiene) y deja solo 2-col (content + index). El botón "Ver original" en iframe mode hace `parent.postMessage({type:'ilp:goHome'})` en vez de ocultar la UI local.
- **El botón "Nueva pestaña" del reader** cambia el `target` del form a `_blank`, hace submit, y lo restaura al iframe. Abre los resultados de búsqueda en una pestaña nueva si el usuario lo pide explícitamente.
- **Mensajes `postMessage` soportados**:
  - `iframe → parent`: `ilp:navigate` (cambiar `viewerIframe.src`), `ilp:goHome` (volver al home), `ilp:openInNewTab` (abrir en nueva pestaña).
  - `parent → iframe`: `ilp:theme` (aplicar tema al srcdoc del home).

## Estructura

```
Leyes-Plus-Argentina/
├── manifest.json
├── icons/                  (icon16/48/128.png)
├── libs/                   (jspdf.umd.min.js, docx.umd.js — lazy-load en SW)
├── src/
│   ├── content/
│   │   ├── shared/         (encoding, storage, parser, highlight, ui-shell)
│   │   ├── infoleg-portal.js
│   │   └── infoleg-norma.js
│   ├── background/
│   │   └── service-worker.js
│   ├── sidepanel/
│   ├── options/
│   ├── popup/
│   └── styles/             (tokens.css, portal.css, reader.css)
└── README.md
```

## Instalación (developer mode)

1. Clonar o copiar la carpeta `Leyes-Plus-Argentina` (o la carpeta renombrada en tu espacio de trabajo) a un directorio local.
2. Abrir `chrome://extensions`, activar **Developer mode** (arriba a la derecha).
3. Click en **Load unpacked** y seleccionar la carpeta correspondiente.
4. La extensión queda activa en `*.infoleg.gob.ar`.

## MVP1 — qué se entrega

- **Reader de ficha** en `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=…`
  - Header con tipo, número, organismo, BO, links a normas que modifica / que la modifican.
  - Parser del texto (artículos + TÍTULO / CAPÍTULO / SECCIÓN / DISPOSICIONES).
  - Índice lateral scrolleable con scroll-spy.
  - Búsqueda in-text con resaltado y prev/next.
  - Temas: light / sepia / dark, persistentes.
  - Tipografía: Source Serif 4 (texto) + Inter (UI), tamaño 70–160 %.
  - Export a PDF (jsPDF), DOCX (docx) en service worker.
  - Export a Markdown local.
  - Copia de artículo individual y de la norma completa.
  - Toggle flotante "Ver original / Modo lectura".
  - Atajos: `j` / `k` (art. siguiente/anterior), `n` / `p` (coincidencia), `/` (foco búsqueda), `g g` (volver al inicio).

- **Portal** en `www.infoleg.gob.ar/` y `?page_id=*`
  - Shell 2 columnas con sidebar de búsqueda (tabs Por norma / Por texto / Por BO / Por organismo) y área principal con placeholder.
  - Quick chips a Constitución Nacional, Códigos, GDE, Contrataciones.
  - Toggle flotante y splitter redimensionable.

## Cobertura

| URL | Soporte |
|---|---|
| `https://www.infoleg.gob.ar/` | Portal shell |
| `https://www.infoleg.gob.ar/?page_id=*` | Portal shell |
| `https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=…` | Reader |
| `https://servicios.infoleg.gob.ar/infolegInternet/buscarNormas.do*` | Portal shell + scraping de resultados (MVP2 completo) |
| `https://servicios.infoleg.gob.ar/infolegInternet/mostrarBusquedaNormas.do` | Portal shell (reemplaza iframe) |

## Privacidad

- **Cero tracking**. Cero requests a hosts externos.
- Cero scraping persistente: los textos se leen on-demand desde `servicios.infoleg.gob.ar` y se mantienen solo en memoria.
- Settings, historial, favoritos y caché del parser van a `chrome.storage.local` (no sincroniza a la nube).
- El usuario puede borrar todo desde la página de opciones.

## Design language

Tokens centralizados en `src/styles/tokens.css`. Mismas familias tipográficas (Inter + Source Serif 4) y mismo acento indigo que la extensión hermana "Córdoba Leyes Reader Pro" para continuidad visual, pero **prefijo `ilp-` en clases y `ilp-` en storage keys** para no colisionar.

## Roadmap

- MVP2: portal de búsqueda 2-col funcional (form + resultados scrapeados) [COMPLETADO].
- MVP3: side panel, favoritos, historial, omnibox `il`, copy-cite con formato `Ley 27801, art. 1° (B.O. 09/03/2026)`.
- MVP4: explorer temático (cons/códigos/digestos), grafo de modificatorias.

## Preparación y Empaquetado para Chrome Web Store

El proyecto incluye un script de automatización (`release.js`) para incrementar versiones y empaquetar de forma limpia la extensión antes de subirla a la Chrome Web Store Developer Dashboard:

1.  **Ejecutar el script de empaquetado:**
    *   Ejecuta en tu terminal el comando: `node release.js` desde el directorio raíz.
    *   Por defecto, esto incrementará automáticamente el número de **parche** (ej. `0.1.1` ➔ `0.1.2`), actualizará `manifest.json`, creará una carpeta `/releases` y empaquetará los directorios de producción (`src/`, `icons/`, `libs/`, y `manifest.json`) en un ZIP listo para producción.
2.  **Modificadores de versión disponibles:**
    *   `node release.js --minor` : Incrementa el número de versión menor (ej. `0.1.1` ➔ `0.2.0`).
    *   `node release.js --major` : Incrementa el número de versión mayor (ej. `0.1.1` ➔ `1.0.0`).
3.  **Subir la extensión:**
    *   Sube el archivo ZIP autogenerado en `releases/leyes-plus-argentina-vX.Y.Z.zip` al Developer Dashboard de Chrome.
4.  **Ficha de la Tienda y Políticas:**
    *   Completa la información promocional del listado y la política de privacidad utilizando los recursos listados en la carpeta [webstore/](file:///C:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/webstore/).

## Onboarding y Ayuda Integrada
Para mitigar la limitación del navegador que impide fijar automáticamente los iconos de extensión en la barra de Chrome, la extensión cuenta con un **asistente de bienvenida y ayuda interactivo** (`ilp-onboarding-modal`). Al instalarse por primera vez, el Service Worker redirige al usuario al Dashboard con el parámetro `?install=true`, abriendo un modal que:
*   Enseña visualmente al usuario cómo fijar la extensión a la barra de Chrome de forma manual.
*   Explica las funciones clave de búsqueda, exportación a PDF/Word y comparación de reformas.

## Requisitos de Sistema y Consumo de RAM
*   **Requisitos de Software:** Google Chrome v88 o superior (u otro navegador basado en Chromium con soporte de Manifest V3). Compatible con Windows, macOS y Linux.
*   **Hardware Mínimo:** CPU Dual-Core a 1.6 GHz, 4 GB de memoria RAM (8 GB recomendados).
*   **Consumo de RAM Estimado:**
    *   *Service Worker en Background:* 0 MB en reposo (suspensión automática de Chrome); 10-20 MB en actividad de exportación.
    *   *Content Scripts inyectados:* 5-15 MB por pestaña (puede subir a 30-60 MB al cargar y parsear códigos masivos como el Código Civil y Comercial).
    *   *Workspace Dashboard:* 20-40 MB en reposo; hasta 100 MB activos en diff engine.

## Licencia

MIT. El contenido de las normas pertenece al Ministerio de Justicia (CC BY 2.5 AR) y siempre se sirve desde el sitio oficial.
