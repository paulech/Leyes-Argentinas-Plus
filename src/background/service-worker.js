/* ==========================================================================
   Leyes-Plus Argentina — Service worker (background)
   Carga lazy de jspdf + docx y maneja exportPdf / exportDocx.
   Procesa marcadores [ILP-TITLE], [ILP-PARA] e [ILP-IMAGE] embebiendo
   las imágenes referenciadas en el PDF/DOCX final.
   ========================================================================== */

importScripts(
  chrome.runtime.getURL('libs/jspdf.umd.min.js'),
  chrome.runtime.getURL('libs/docx.umd.js')
);

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
});

// Open onboarding page on first install or handle updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html?install=true') });
  } else if (details.reason === 'update') {
    console.log('[Leyes-Plus] Extensión actualizada con éxito desde la versión:', details.previousVersion);
  }
});

// Actualización automática al instante cuando Chrome descarga una nueva versión
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('[Leyes-Plus] Nueva versión descargada y disponible:', details.version);
  // Recarga la extensión en segundo plano para aplicar la actualización de forma silenciosa e inmediata
  chrome.runtime.reload();
});


function isStructuralHeader(line) {
  if (!line) return false;
  const u = (line || '').toUpperCase();
  return (
    u.startsWith('LIBRO') ||
    u.startsWith('PARTE') ||
    u.startsWith('TITULO') ||
    u.startsWith('TÍTULO') ||
    u.startsWith('CAPITULO') ||
    u.startsWith('CAPÍTULO') ||
    u.startsWith('SECCION') ||
    u.startsWith('SECCIÓN') ||
    u.startsWith('SUBCAPITULO') ||
    u.startsWith('SUBCAPÍTULO') ||
    u.startsWith('DISPOSICION') ||
    u.startsWith('DISPOSICIÓN') ||
    u.startsWith('DISPOSICIONES')
  );
}

/** Desenvuelve [ILP-TITLE: texto] → texto. Si no hay marcador, devuelve la línea. */
function unwrapTitleMarker(line) {
  if (!line) return '';
  const m = line.match(/^\[ILP-TITLE:\s*([^\]]+?)\s*\]$/);
  return m ? m[1].trim() : line;
}

/** Despliega una cadena con marcadores ILP-* en un array de líneas estructuradas. */
function parseExportLines(text) {
  if (!text) return [];
  const out = [];
  text.split('\n').forEach((line) => {
    const trimmed = (line || '').trim();
    if (!trimmed) return;
    if (trimmed === '[ILP-PARA]') { out.push({ type: 'paragraphBreak' }); return; }
    const titleMatch = trimmed.match(/^\[ILP-TITLE:\s*(.+?)\]$/);
    if (titleMatch) {
      const content = titleMatch[1].trim();
      out.push({ type: isStructuralHeader(content) ? 'structural' : 'subtitle', content });
      return;
    }
    const imgMatch = trimmed.match(/^\[ILP-IMAGE:\s*(.+?)\]$/);
    if (imgMatch) {
      out.push({ type: 'image', content: imgMatch[1].trim() });
      return;
    }
    out.push({ type: 'text', content: trimmed });
  });
  return out;
}

/** Detecta formato de imagen y devuelve {format, width, height} en píxeles. */
function getImageMetadata(bytes) {
  if (!bytes || bytes.length < 24) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    return { format: 'PNG', width, height };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      const marker = bytes[i + 1];
      // SOF0, SOF2 (0xC0, 0xC2) y SOF1..SOF15 (excepto 0xC4, 0xC8, 0xCC)
      if ((marker >= 0xC0 && marker <= 0xC3) ||
          (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) ||
          (marker >= 0xCD && marker <= 0xCF)) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width  = (bytes[i + 7] << 8) | bytes[i + 8];
        return { format: 'JPEG', width, height };
      }
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + segLen;
    }
    return null;
  }
  // GIF87a / GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    const width  = bytes[6]  | (bytes[7]  << 8);
    const height = bytes[8]  | (bytes[9]  << 8);
    return { format: 'GIF', width, height };
  }
  return null;
}

/** Cache de imágenes ya descargadas (Map<url, {dataUri, format, width, height}>). */
const imageCache = new Map();

async function loadImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) { imageCache.set(url, null); return null; }
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const meta = getImageMetadata(bytes);
    if (!meta) { imageCache.set(url, null); return null; }
    // Convertir a data URI para que jspdf y docx lo acepten sin problemas
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    const base64 = btoa(binary);
    const dataUri = `data:image/${meta.format.toLowerCase()};base64,${base64}`;
    const result = { dataUri, ...meta };
    imageCache.set(url, result);
    return result;
  } catch (err) {
    console.warn('[ILP] loadImage failed for', url, err);
    imageCache.set(url, null);
    return null;
  }
}

async function generatePdf(lawData) {
  const { jsPDF } = self.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxW = pageWidth - margin * 2;
  let y = 20;

  function breakPage(lines, lineH = 5.5) {
    if (y + lines * lineH > pageHeight - margin) {
      doc.addPage();
      y = 20;
    }
  }

  async function writeLines(lines) {
    for (const ln of lines) {
      if (ln.type === 'paragraphBreak') { y += 3; breakPage(1, 5); continue; }
      if (ln.type === 'structural') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
      } else if (ln.type === 'subtitle') {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
      } else if (ln.type === 'image') {
        const img = await loadImage(ln.content);
        if (img && img.width && img.height) {
          let w = maxW;
          let h = (img.height / img.width) * w;
          // Si la imagen es muy alta, ajustar al área imprimible
          const maxH = pageHeight - margin * 2;
          if (h > maxH) {
            h = maxH;
            w = (img.width / img.height) * h;
          }
          breakPage(Math.ceil(h / 6), 6);
          doc.addImage(img.dataUri, img.format, margin, y, w, h);
          y += h + 4;
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(150);
          breakPage(1, 4);
          doc.text(`[Imagen no disponible: ${ln.content}]`, margin, y);
          y += 4;
          doc.setTextColor(0);
        }
        continue;
      } else { // text
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
      }
      const wrapped = doc.splitTextToSize(ln.content, maxW);
      wrapped.forEach((w) => {
        breakPage(1, 5);
        doc.text(w, margin, y);
        y += 5;
      });
      y += 1.5;
    }
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.splitTextToSize(lawData.title || 'Norma', maxW).forEach((line) => {
    breakPage(1, 7);
    doc.text(line, margin, y);
    y += 7;
  });
  y += 4;

  // Preamble
  if (lawData.preamble) {
    await writeLines(parseExportLines(lawData.preamble));
    y += 2;
  }

  // Articles
  for (const art of (lawData.articles || [])) {
    if (art.headers && art.headers.length) {
      for (const h of art.headers) {
        const cleanH = unwrapTitleMarker(h);
        if (!cleanH) continue;
        if (isStructuralHeader(cleanH)) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
        }
        doc.splitTextToSize(cleanH, maxW).forEach((line) => {
          breakPage(1, 5.5);
          doc.text(line, margin, y);
          y += 5.5;
        });
        y += 1;
      }
      y += 1;
    }
    // Article prefix
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const cleanPrefix = unwrapTitleMarker(art.prefix);
    doc.splitTextToSize(cleanPrefix, maxW).forEach((line) => {
      breakPage(1, 6);
      doc.text(line, margin, y);
      y += 6;
    });
    y += 1;
    // Article body (con imágenes y marcadores procesados)
    await writeLines(parseExportLines(art.text || ''));
    y += 2;
  }

  if (lawData.footer) {
    y += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    await writeLines(parseExportLines(lawData.footer));
  }

  // Paginación
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Leyes-Plus Argentina · ${i}/${pageCount}`, margin, pageHeight - 8);
    doc.setTextColor(0);
  }

  return doc.output('datauristring');
}

async function generateDocx(lawData) {
  const { Document, Packer, Paragraph, HeadingLevel, AlignmentType, ImageRun } = self.docx;
  const children = [];
  // 1 inch = 914400 EMU. Usamos unidades pixel-friendly: 1 px = 9525 EMU.
  const PX_TO_EMU = 9525;

  async function buildParagraphsFromText(text) {
    const out = [];
    const lines = parseExportLines(text);
    for (const ln of lines) {
      if (ln.type === 'paragraphBreak') { out.push(null); continue; }
      if (ln.type === 'structural') {
        out.push(new Paragraph({ text: ln.content, heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 } }));
      } else if (ln.type === 'subtitle') {
        out.push(new Paragraph({ text: ln.content, italics: true, spacing: { before: 120, after: 60 } }));
      } else if (ln.type === 'image') {
        const img = await loadImage(ln.content);
        if (img && img.width && img.height) {
          const maxWPx = 600;
          let w = img.width;
          let h = img.height;
          if (w > maxWPx) {
            const ratio = maxWPx / w;
            w = maxWPx;
            h = Math.round(h * ratio);
          }
          try {
            const buf = Uint8Array.from(atob(img.dataUri.split(',')[1]), c => c.charCodeAt(0));
            out.push(new Paragraph({
              children: [new ImageRun({
                data: buf,
                transformation: { width: w * PX_TO_EMU, height: h * PX_TO_EMU }
              })],
              spacing: { before: 120, after: 120 },
              alignment: AlignmentType.CENTER
            }));
          } catch (err) {
            out.push(new Paragraph({ text: `[Imagen no disponible: ${ln.content}]`, italics: true, spacing: { before: 60, after: 60 } }));
          }
        } else {
          out.push(new Paragraph({ text: `[Imagen no disponible: ${ln.content}]`, italics: true, spacing: { before: 60, after: 60 } }));
        }
      } else { // text
        out.push(new Paragraph({ text: ln.content, spacing: { after: 120 }, alignment: AlignmentType.JUSTIFY }));
      }
    }
    return out;
  }

  children.push(new Paragraph({
    text: lawData.title || 'Norma',
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 240 },
    alignment: AlignmentType.CENTER
  }));

  if (lawData.preamble) {
    const paras = await buildParagraphsFromText(lawData.preamble);
    paras.forEach((p) => { if (p) children.push(p); });
  }

  for (const art of (lawData.articles || [])) {
    if (art.headers && art.headers.length) {
      for (const h of art.headers) {
        const cleanH = unwrapTitleMarker(h);
        if (!cleanH) continue;
        if (isStructuralHeader(cleanH)) {
          children.push(new Paragraph({ text: cleanH, heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 } }));
        } else {
          children.push(new Paragraph({ text: cleanH, italics: true, spacing: { before: 120, after: 60 } }));
        }
      }
    }
    const cleanPrefix = unwrapTitleMarker(art.prefix);
    children.push(new Paragraph({ text: cleanPrefix, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 100 } }));
    const bodyParas = await buildParagraphsFromText(art.text || '');
    bodyParas.forEach((p) => { if (p) children.push(p); });
  }

  if (lawData.footer) {
    children.push(new Paragraph({ text: '—', spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER }));
    const footerParas = await buildParagraphsFromText(lawData.footer);
    footerParas.forEach((p) => { if (p) children.push(p); });
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return await Packer.toBase64String(doc);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === 'bgFetch') {
    const { url, method, body } = message;
    const options = {
      method: method || 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Cache-Control': 'no-cache',
      }
    };
    if (method === 'POST' && body) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = body;
    }
    fetch(url, options)
      .then(async (res) => {
        const buffer = await res.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        sendResponse({
          success: true,
          status: res.status,
          statusText: res.statusText,
          url: res.url,
          bytes: bytes
        });
      })
      .catch((err) => {
        console.error('[ILP] bgFetch failed', err);
        sendResponse({ success: false, error: String(err) });
      });
    return true;
  }

  if (message.action === 'exportPDF') {
    generatePdf(message.lawData).then((dataUri) => {
      sendResponse({ success: true, dataUri });
    }).catch((err) => {
      console.error('[ILP] pdf export failed', err);
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (message.action === 'exportDOCX') {
    generateDocx(message.lawData).then((base64) => {
      sendResponse({ success: true, base64 });
    }).catch((err) => {
      console.error('[ILP] docx export failed', err);
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  return false;
});
