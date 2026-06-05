# Ficha de Publicación — Chrome Web Store (Leyes-Plus Argentina)

Este documento contiene los metadatos oficiales y la descripción en español requeridos para subir la extensión a la Chrome Web Store Developer Dashboard.

---

## 1. Detalles Básicos de la Ficha

*   **Nombre de la Extensión:** Leyes-Plus Argentina
*   **Título Corto (Máx. 30 caracteres):** Leyes-Plus Argentina
*   **Descripción Corta (Máx. 150 caracteres):** Dashboard premium con lector avanzado, índice de artículos y motor de comparación de reformas (diff) para legislación consolidada de InfoLeg.

---

## 2. Descripción Detallada (Máx. 16,000 caracteres)

**Leyes-Plus Argentina** transforma por completo tu experiencia de lectura e investigación jurídica sobre el sitio oficial InfoLeg de la República Argentina. 

¿Cansado de la navegación en plantillas web obsoletas, textos de leyes desorganizados y la imposibilidad de comparar reformas? Esta extensión añade una capa visual moderna y premium que optimiza el texto legislativo convirtiendo el portal en un espacio de trabajo inteligente y fluido, **respetando el origen y autoría de los datos oficiales del Ministerio de Justicia**.

### 🌟 CARACTERÍSTICAS PRINCIPALES

*   **Lector de Leyes de Alta Gama:** Interfaz limpia con control tipográfico variable (Inter / Source Serif 4), temas visuales optimizados (Claro, Sepia y Oscuro) y ancho de lectura configurado para reducir la fatiga visual.
*   **Índice y Scroll-Spy Lateral:** Genera un índice interactivo de artículos con navegación suave en tiempo real que resalta la sección exacta que estás leyendo.
*   **Comparación de Reformas (Diff Engine):** Alinea automáticamente el texto consolidado actualizado contra la versión original de sanción de la ley y resalta en rojo (eliminado) y verde (insertado) las palabras y párrafos modificados con el algoritmo LCS de alta precisión.
*   **Buscador Integrado (SPA):** Busca leyes nacionales directamente desde la barra lateral sin necesidad de recargar la pestaña del navegador ni perder tu documento actual.
*   **Exportación Premium:** Descarga las normas limpias de ruido en formatos PDF (diagramado para impresión) o documento de Word (.docx) procesando de forma perezosa e incrustando las imágenes oficiales de los anexos.
*   **Integración con Leyes de Córdoba:** Lector mejorado integrado de forma nativa para el portal provincial `web2.cba.gov.ar` con las mismas prestaciones premium.

---

## 3. Instrucciones de Ayuda y Guía de Uso

1.  **Instalación inicial:**
    *   Una vez instalada la extensión, se abrirá automáticamente el Dashboard del Espacio de Trabajo Jurídico.
2.  **📌 Cómo Fijar el Icono (Instrucciones de Pinning):**
    *   Dado que Chrome no permite que las extensiones se fijen solas por motivos de seguridad, haz clic en el icono de **Extensiones (pieza de rompecabezas)** en la esquina superior derecha del navegador Chrome.
    *   Busca **Leyes-Plus Argentina** y haz clic en el icono de la **chincheta/pin**. Esto dejará el botón azul de acceso rápido siempre visible junto a tu barra de direcciones.
3.  **Uso en Portales Oficiales:**
    *   Al navegar a cualquier norma en `www.infoleg.gob.ar` o `web2.cba.gov.ar`, la extensión inyectará el lector moderno automáticamente.
    *   Si en algún momento deseas ver la versión clásica del gobierno, simplemente añade `?ilp-bypass=true` al final de la dirección URL de la página.

---

## 4. Requisitos de Sistema y Consumo Estimado de Memoria (RAM)

La extensión está diseñada bajo el estándar Manifest V3 (MV3) de Google Chrome, garantizando la máxima eficiencia energética y de memoria posible.

### Consumo Estimado de Memoria RAM:
*   **Service Worker (Background):** Se ejecuta únicamente en respuesta a eventos (exportaciones o llamadas CORS) y se suspende tras 30 segundos de inactividad, consumiendo **0 MB** en reposo. Durante su breve uso activo consume entre **10 MB y 20 MB**.
*   **Content Scripts (Inyectados en pestañas):** Añaden únicamente entre **5 MB y 15 MB** de uso a la pestaña abierta. Durante el procesamiento sintáctico de leyes extremadamente extensas (ej. Código Civil y Comercial de más de 2500 artículos), el consumo puede elevarse temporalmente entre **30 MB y 60 MB** debido a la carga DOM.
*   **Dashboard Standalone:** La aplicación completa de espacio de trabajo consume entre **20 MB y 40 MB** en reposo y hasta **100 MB** al realizar una comparación diff pesada de textos masivos en memoria.

### Requisitos Mínimos de Funcionamiento:
*   **Navegador:** Google Chrome v88 o superior (o cualquier navegador basado en Chromium como Edge, Brave u Opera que soporte Manifest V3).
*   **Memoria RAM del Sistema:** 4 GB de RAM mínimos (8 GB recomendados).
*   **Procesador:** Procesador de doble núcleo a 1.6 GHz o superior (Intel Core i3, AMD Ryzen 3 o Apple Silicon).
*   **Almacenamiento:** Menos de 2 MB de espacio libre en disco para los archivos de la extensión, y un espacio dinámico asignado localmente en `chrome.storage.local` menor a 5 MB para favoritos e historial.
*   **Conectividad:** Requiere conexión a internet activa para descargar los datos desde InfoLeg y el portal de Córdoba. El parseo y el diff son 100% locales.

---

## 5. Declaración de Privacidad y Permisos

*   **storage:** Para guardar localmente tu historial de búsquedas, tus leyes marcadas como favoritas y la configuración visual elegida (tema, tamaño de letra).
*   **clipboardWrite:** Utilizado únicamente para permitir la acción del botón "Copiar Cita" o "Copiar Artículo".
*   **Host Perms (*.infoleg.gob.ar, web2.cba.gov.ar):** Permite a la extensión interceptar y formatear la navegación en dichos portales, además de saltar limitaciones de CORS cross-origin de forma segura.
*   **Política de Datos:** Cero recopilación de telemetría. La extensión no envía ningún tipo de información a servidores externos ni analiza tus hábitos de lectura. Toda la información permanece local en tu navegador.
