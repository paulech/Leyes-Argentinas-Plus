/* ==========================================================================
   Leyes-Plus Argentina — Shared module: parser
   Parsea texto crudo de normas argentinas en estructura
   { title, preamble, articles[], footer }.
   Estrategia derivada de la usada en Córdoba Leyes Pro y adaptada
   a los patrones reales de Infoleg (encoding mixto, sin markup).
   ========================================================================== */

(function () {
  'use strict';

  const NS = (window.ILP = window.ILP || {});

  function yieldToMain() {
    return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function isStructuralHeader(line) {
    if (!line) return false;
    const trimmed = line.trim();
    // Match structure keywords followed optionally by numbers, roman numerals, or typical sub-keywords
    const match = trimmed.match(/^(LIBRO|PARTE|TITULO|TÍTULO|CAPITULO|CAPÍTULO|SECCION|SECCIÓN|SUBCAPITULO|SUBCAPÍTULO|SUBSECCIÓN|ANEXO|ANEXOS|DISPOSICION|DISPOSICIÓN|DISPOSICIONES)(?:\s+([IVXLCDM\d]+|UNICO|ÚNICO|TRANSITORIAS|TRANSITORIA|COMPLEMENTARIAS|COMPLEMENTARIA))?\b/i);
    if (!match) return false;

    const rest = trimmed.slice(match[0].length).trim();
    if (!rest) return true; // Ends right after, e.g. "CAPITULO II" or "ANEXO"

    // If it starts with a separator
    if (/^[–—\-:\.]/.test(rest)) return true;

    // Otherwise, check length and search for narrative words
    if (trimmed.length > 60) return false;
    if (/\b(ley|esta|deberá|deberán|pueden|podrán|serán|salvo|conforme)\b/i.test(trimmed)) {
      return false;
    }

    return true;
  }

  function isSubtitleLine(line) {
    if (!line || line.length > 80) return false;
    if (!/^[A-ZÁÉÍÓÚÑ0-9\*\-\–\—\(\)§]/.test(line)) return false;
    if (/^[a-z0-9]+[\)\.\-]/i.test(line)) return false;
    if (/^(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?)\b/i.test(line)) return false;
    if (isStructuralHeader(line)) return false;
    if (/\t/.test(line)) return false; // table rows: no son subtítulos
    return true;
  }

  /** Extrae el texto real de un marcador [ILP-TITLE: texto], o devuelve la línea. */
  function unwrapTitleMarker(line) {
    const m = (line || '').match(/^\[ILP-TITLE:\s*(.+?)\]$/);
    return m ? m[1].trim() : line;
  }

  /** Como isStructuralHeader pero también reconoce marcadores [ILP-TITLE]. */
  function isStructuralOrTitleLine(line) {
    return isStructuralHeader(unwrapTitleMarker(line));
  }

  /** Como isSubtitleLine pero también reconoce marcadores [ILP-TITLE]. */
  function isSubtitleOrTitleLine(line) {
    return isSubtitleLine(unwrapTitleMarker(line));
  }

  // Patrones comunes de artículo: "Artículo 1°-", "Art. 2°-", "ARTICULO 3",
  // "Articulo 4 bis.-", "Artículo 5°.-"
  const ARTICLE_REGEX = /^([\s\*\-\–\—•]*)(Art[ií]cul[oó]|Art[ií]c\.?|Art\.?)\s*(\d+(?:[\sº°ª]*(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies|[a-z]))?)\b([\sº°\.\-–—:]*)(\.?[\-–—:]?)\s*(.*)/i;

  function isRealArticleHeading(match) {
    const prefix = match[2];  // "ARTICULO", "Art.", etc.
    const separator = (match[4] || '') + (match[5] || '');
    const rest = (match[6] || '').trim();

    // 1. Prefix capitalization: must start with capital letter. Lowercase references are inside text.
    if (prefix[0] !== prefix[0].toUpperCase()) {
      return false;
    }

    // 2. Strict whitelist of standard capitalized/uppercase prefixes
    if (!/^(ARTICULO|ART[IÍ]CULO|Art[ií]culo|Articulo|ART\.?|Art\.?)$/.test(prefix)) {
      return false;
    }

    // 3. Strong separator check (º, °, -, ., etc.)
    const cleanSep = separator.replace(/\s+/g, '');
    const hasStrongSeparator = /[º°\-\–\—\.]/.test(cleanSep);

    // 4. Heuristic checking: stop words immediately after the number
    if (rest) {
      const firstWord = rest.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
      const stopWords = ['de', 'del', 'la', 'lo', 'las', 'los', 'el', 'en', 'con', 'por', 'para', 'que', 'inc', 'inciso', 'y', 'o', 'a'];
      if (stopWords.includes(firstWord)) {
        if (!hasStrongSeparator) {
          return false;
        }
      }
    }

    return true;
  }

  function findArticleIndices(lines) {
    const out = [];
    let lastRestartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(ARTICLE_REGEX);
      if (m && isRealArticleHeading(m)) {
        const numVal = parseInt(m[3], 10);
        if (numVal === 1 && out.length > 0 && out.length <= 15) {
          lastRestartIndex = out.length;
        }
        out.push({ index: i, match: m });
      }
    }
    const firstArticleOne = out.findIndex((entry) => parseInt(entry.match[3], 10) === 1);
    if (firstArticleOne > 0 && firstArticleOne <= 40) {
      return out.slice(firstArticleOne);
    }
    if (lastRestartIndex > 0) {
      return out.slice(lastRestartIndex);
    }
    return out;
  }

  function cleanText(s) {
    if (!s) return '';
    return s
      .replace(/Fiscal[ií]a\s+de\s+Estado/gi, '')
      .replace(/Direcci[oó]n\s+de\s+Inform[aá]tica\s+Jur[ií]dica/gi, '')
      .replace(/Gobierno\s+de\s+la\s+Provincia\s+de\s+C[oó]rdoba/gi, '')
      .replace(/Ministerio\s+de\s+Justicia\s+y\s+Derechos\s+Humanos/gi, '')
      .replace(/InfoLEG\s*-\s*Informaci[oó]n\s+Legislativa/gi, '')
      .replace(/©/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ ]+/g, ' ')                     // colapsar SOLO espacios
      .replace(/(\t)+/g, '\t')                  // colapsar runs de tabs a 1 tab
      .replace(/ \n/g, '\n')                    // quitar espacios al final de línea
      .replace(/\n[ \t]+/g, '\n')               // indent al inicio
      .replace(/\n{3,}/g, '\n\n')               // max 2 saltos
      .trim();
  }

  function joinTextLines(lines) {
    if (!lines || lines.length === 0) return '';
    // Preserve every extracted line to avoid collapsing legal paragraphs.
    return lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }

  function splitBetweenLinesForArticle(between, isFirstArticle) {
    let headers = [];
    let bodyForPrev = [];
    let preambleChunk = [];

    if (isFirstArticle) {
      let firstStruct = -1;
      for (let i = 0; i < between.length; i++) {
        if (isStructuralOrTitleLine(between[i])) {
          firstStruct = i;
          break;
        }
      }
      if (firstStruct !== -1) {
        preambleChunk = between.slice(0, firstStruct);
        headers = between.slice(firstStruct);
      } else {
        let headerStart = between.length;
        for (let i = between.length - 1; i > 0; i--) {
          if (isStructuralOrTitleLine(between[i]) || isSubtitleOrTitleLine(between[i])) headerStart = i;
          else break;
        }
        preambleChunk = between.slice(0, headerStart);
        headers = between.slice(headerStart);
      }
    } else {
      let firstStruct = -1;
      for (let i = 0; i < between.length; i++) {
        if (isStructuralOrTitleLine(between[i])) {
          firstStruct = i;
          break;
        }
      }
      if (firstStruct !== -1) {
        bodyForPrev = between.slice(0, firstStruct);
        headers = between.slice(firstStruct);
      } else {
        const last = between.length - 1;
        if (last >= 0 && isSubtitleOrTitleLine(between[last])) {
          bodyForPrev = between.slice(0, last);
          headers = [between[last]];
        } else {
          bodyForPrev = between;
        }
      }
    }

    return { preambleChunk, headers, bodyForPrev };
  }

  function buildParsedSections(lines, articleIndices) {
    const articles = [];
    let preambleLines = [];
    let lastArticleEndIndex = 0;
    // Strip [ILP-PARA] from between-article lines before header/body splitting.
    // They are only needed inside article body text (handled by formatTextWithImages).
    const stripParaMarkers = (arr) => arr.filter((l) => l !== '[ILP-PARA]');

    for (let a = 0; a < articleIndices.length; a++) {
      const { index: artIndex, match: artMatch } = articleIndices[a];
      const between = stripParaMarkers(lines.slice(lastArticleEndIndex, artIndex));
      const split = splitBetweenLinesForArticle(between, a === 0);

      if (a === 0) {
        preambleLines = split.preambleChunk;
      } else if (split.bodyForPrev.length > 0) {
        const prev = articles[articles.length - 1];
        prev.textLines.push(...split.bodyForPrev);
        prev.text = joinTextLines(prev.textLines);
        prev.fullText = prev.prefix + '\n' + prev.text;
      }

      const bodyStart = (artMatch[6] || '').trim();
      const prefixRaw = (artMatch[1] || '') + (artMatch[2] || '') + ' ' + (artMatch[3] || '') + (artMatch[4] || '');
      const num = (artMatch[3] || '').trim();

      articles.push({
        num,
        prefix: prefixRaw.trim(),
        headers: split.headers,
        textLines: bodyStart ? [bodyStart] : [],
        text: bodyStart,
        fullText: prefixRaw.trim() + (bodyStart ? '\n' + bodyStart : '')
      });
      lastArticleEndIndex = artIndex + 1;
    }

    const remaining = lines.slice(lastArticleEndIndex);
    let footerStart = remaining.length;
    for (let i = 0; i < remaining.length; i++) {
      if (/^(DADO|DADA|SALA DE SESIONES|FIRMANTES|FDO|REGISTRESE|COMUNIQUESE|COMUN[IÍ]QUESE|REGISTRADA BAJO|PROMULGADA)/i.test(remaining[i])) {
        footerStart = i;
        break;
      }
    }

    const lastBody = remaining.slice(0, footerStart);
    const footerLines = remaining.slice(footerStart);

    if (articles.length > 0) {
      const last = articles[articles.length - 1];
      last.textLines.push(...lastBody);
      last.text = joinTextLines(last.textLines);
      last.fullText = last.prefix + '\n' + last.text;
    } else {
      // Sin artículos: todo el cuerpo es preámbulo
      preambleLines = preambleLines.concat(lastBody);
    }

    return { preambleLines, articles, footerLines };
  }

  function pickTitleFromPreamble(preambleLines) {
    for (const line of preambleLines) {
      if (line === '[ILP-PARA]') continue;
      if (/^\[ILP-TITLE:/i.test(line)) continue;
      if (line.length > 4 && line.length < 200) {
        return line;
      }
    }
    return 'Normativa';
  }

  /**
   * Parser síncrono. Usar solo para textos < 90k chars.
   */
  function parseLawText(rawText) {
    const text = cleanText(rawText);
    // Preservar saltos de párrafo (\n\n) como marcadores antes de filtrar líneas vacías
    const textWithParaMarkers = text.replace(/\n\n/g, '\n[ILP-PARA]\n');
    const lines = textWithParaMarkers
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return { title: 'Normativa', preamble: '', articles: [], footer: '' };
    }

    const articleIndices = findArticleIndices(lines);
    const { preambleLines, articles, footerLines } = buildParsedSections(lines, articleIndices);
    const title = pickTitleFromPreamble(preambleLines);

    return {
      title,
      preamble: preambleLines
        .filter((l) => l !== title && l !== '[ILP-PARA]')
        .map((l) => unwrapTitleMarker(l))
        .join('\n\n'),
      articles,
      footer: footerLines
        .filter((l) => l !== '[ILP-PARA]')
        .map((l) => unwrapTitleMarker(l))
        .join('\n\n')
    };
  }

  /**
   * Parser asíncrono. Realiza yield al main thread cada 100 artículos.
   */
  async function parseLawTextAsync(rawText) {
    const text = cleanText(rawText);
    // Preservar saltos de párrafo como marcadores antes de filtrar líneas vacías
    const textWithParaMarkers = text.replace(/\n\n/g, '\n[ILP-PARA]\n');
    const lines = textWithParaMarkers
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return { title: 'Normativa', preamble: '', articles: [], footer: '' };
    }

    const articleIndices = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(ARTICLE_REGEX);
      if (m && isRealArticleHeading(m)) {
        articleIndices.push({ index: i, match: m });
      }
      if (i > 0 && i % 1500 === 0) await yieldToMain();
    }

    const { preambleLines, articles, footerLines } = buildParsedSections(lines, articleIndices);
    const title = pickTitleFromPreamble(preambleLines);

    return {
      title,
      preamble: preambleLines
        .filter((l) => l !== title && l !== '[ILP-PARA]')
        .map((l) => unwrapTitleMarker(l))
        .join('\n\n'),
      articles,
      footer: footerLines
        .filter((l) => l !== '[ILP-PARA]')
        .map((l) => unwrapTitleMarker(l))
        .join('\n\n')
    };
  }

  /**
   * Strips all ILP-* markers from a chunk of article text, returning clean
   * plain text suitable for copy-to-clipboard / export.
   *
   * - [ILP-IMAGE: url]       → dropped (placeholder opcional con keepImages=true)
   * - [ILP-TITLE: foo]       → "foo" (unwrap)
   * - [ILP-PARA]             → "\n\n" (paragraph break)
   * Excess blank lines are collapsed to a single \n\n.
   */
  function stripMarkers(text, keepImages = false) {
    if (!text) return '';
    return text
      .replace(/\[ILP-IMAGE:\s*([^\]]+)\]/g, (_, url) => keepImages ? `[Imagen: ${url.trim()}]` : '')
      .replace(/\[ILP-TITLE:\s*([^\]]+?)\s*\]/g, '$1')
      .replace(/\[ILP-PARA\]/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/\n[ \t]+/g, '\n');
  }

  /** Returns all image URLs found in [ILP-IMAGE: url] markers, in order, deduped. */
  function extractImageUrls(text) {
    if (!text) return [];
    const seen = new Set();
    const out = [];
    const re = /\[ILP-IMAGE:\s*([^\]]+)\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const url = m[1].trim();
      if (url && !seen.has(url)) { seen.add(url); out.push(url); }
    }
    return out;
  }

  /**
   * Parses article text into a structured array of line-objects for export
   * (PDF/DOCX) and other consumers that need to distinguish structural headers,
   * subtitles, paragraph breaks, embedded images, and plain text.
   *
   * Each line object: { type, content, level? } where type ∈
   *   'structural' | 'subtitle' | 'image' | 'paragraphBreak' | 'text'
   */
  function parseArticleLines(text) {
    if (!text) return [];
    const out = [];
    text.split('\n').forEach((line) => {
      const trimmed = (line || '').trim();
      if (!trimmed) return;
      if (trimmed === '[ILP-PARA]') { out.push({ type: 'paragraphBreak' }); return; }
      const titleMatch = trimmed.match(/^\[ILP-TITLE:\s*(.+?)\]$/);
      if (titleMatch) {
        const content = titleMatch[1].trim();
        if (isStructuralHeader(content)) {
          out.push({ type: 'structural', content, level: 1 });
        } else {
          out.push({ type: 'subtitle', content });
        }
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

  NS.parser = {
    parseLawText,
    parseLawTextAsync,
    isStructuralHeader,
    isSubtitleLine,
    unwrapTitleMarker,
    stripMarkers,
    extractImageUrls,
    parseArticleLines
  };
})();
