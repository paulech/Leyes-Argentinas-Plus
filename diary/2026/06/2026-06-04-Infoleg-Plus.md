# Project DevLog: Infoleg-Plus
* **📅 Date**: 2026-06-04
* **🏷️ Tags**: `#Project` `#DevLog`

---

> 🎯 **Progress Summary**
> Conectamos y optimizamos la barra de herramientas del lector con botones de icono compactos, solucionamos la alineación errónea de artículos inline del parser (considerandos cortados) y resolvimos la superposición de z-index de los desplegables de relaciones.

### 🛠️ Execution Details & Changes
* **Core File Modifications**:
  * 📄 [infoleg-norma.js](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/content/infoleg-norma.js): Agregado condicional de bypass al inicio.
  * 📄 [infoleg-portal.js](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/content/infoleg-portal.js): Agregado condicional de bypass al inicio.
  * 📄 [parser.js](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/content/shared/parser.js): Añadida validación `isRealArticleHeading` para descartar falsas alarmas de artículos inline (sensibilidad a mayúsculas, preposiciones y stop-words).
  * 📄 [index.html](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/dashboard/index.html): Configuración de botones de icono compactos y reetiquetado de InfoLeg ↗.
  * 📄 [index.js](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/dashboard/index.js): Lógica de copiado completo, LCS para alineación de artículos, diff de palabras, navegación de búsqueda interna e inyecciones de bypass.
  * 📄 [style.css](file:///c:/_Temp/Infoleg%20y%20leyes/Infoleg-Plus/src/dashboard/style.css): Reglas de z-index para la barra superior, estilos `.ilp-btn-icon-only`, marcado diff, resaltados y stylesheet de impresión.
* **Technical Implementation**:
  * Implementación de bypass de extensión cuando la URL contiene `ilp-bypass=true`.
  * Algoritmo LCS para alinear artículos por identificador y marcar inserciones/eliminaciones/modificaciones tanto en el lector como en el TOC lateral.
  * Buscador interno mediante TreeWalker con resaltado dinámico y scroll suave.
  * Hoja de estilos `@media print` para impresión y exportación PDF limpia.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered**: Desplegables de relaciones no aparecían porque la barra superior era estática y quedaba oculta por el layout posicionado relativo de abajo.
> 💡 **Solution**: Agregamos `position: relative; z-index: 10;` a `#ilp-reader-toolbar` para corregir el contexto de apilamiento en el navegador.

### ⏭️ Next Steps
- [ ] Empaquetar y probar la extensión en un entorno limpio.
- [ ] Recopilar feedback del usuario sobre la velocidad de comparación diff en leyes extremadamente largas.
