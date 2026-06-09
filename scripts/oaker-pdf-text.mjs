import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function findObjectRanges(buffer) {
  const text = buffer.toString('latin1');
  const matches = Array.from(text.matchAll(/(?:^|\n)(\d+)\s+(\d+)\s+obj\b/g));
  const ranges = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const nextStart = index + 1 < matches.length ? matches[index + 1].index : text.length;
    const endObject = text.indexOf('endobj', start);
    ranges.push({
      id: Number(match[1]),
      generation: Number(match[2]),
      start,
      end: endObject === -1 ? nextStart : endObject + 'endobj'.length,
    });
  }

  return ranges;
}

function sliceObject(buffer, range) {
  return buffer.subarray(range.start, range.end);
}

function objectHeaderText(objectBuffer) {
  const streamIndex = objectBuffer.indexOf(Buffer.from('stream'));
  const header = streamIndex === -1 ? objectBuffer : objectBuffer.subarray(0, streamIndex);
  return header.toString('latin1');
}

function streamBytes(objectBuffer) {
  const streamMarker = Buffer.from('stream');
  const endMarker = Buffer.from('endstream');
  const streamIndex = objectBuffer.indexOf(streamMarker);
  if (streamIndex === -1) return null;
  let start = streamIndex + streamMarker.length;
  if (objectBuffer[start] === 0x0d && objectBuffer[start + 1] === 0x0a) start += 2;
  else if (objectBuffer[start] === 0x0a) start += 1;
  const end = objectBuffer.indexOf(endMarker, start);
  if (end === -1) return null;
  let stream = objectBuffer.subarray(start, end);
  while (stream.length && (stream[stream.length - 1] === 0x0a || stream[stream.length - 1] === 0x0d)) {
    stream = stream.subarray(0, stream.length - 1);
  }
  return stream;
}

function decodedStream(objectBuffer) {
  const header = objectHeaderText(objectBuffer);
  const bytes = streamBytes(objectBuffer);
  if (!bytes) return null;
  if (!/\/FlateDecode\b/.test(header)) return bytes;

  try {
    return inflateSync(bytes);
  } catch {
    return null;
  }
}

function balancedDictionary(text, startIndex) {
  if (startIndex < 0 || text.slice(startIndex, startIndex + 2) !== '<<') return '';
  let depth = 0;
  for (let index = startIndex; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    if (pair === '<<') {
      depth += 1;
      index += 1;
    } else if (pair === '>>') {
      depth -= 1;
      index += 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }
  return '';
}

function referencesFromDictionary(dictionaryText) {
  const refs = new Map();
  for (const match of dictionaryText.matchAll(/\/([A-Za-z0-9_.-]+)\s+(\d+)\s+(\d+)\s+R/g)) {
    refs.set(match[1], Number(match[2]));
  }
  return refs;
}

function refsFromArray(text, key) {
  const match = new RegExp(`\\/${key}\\s*\\[(.*?)\\]`, 's').exec(text);
  if (!match) return [];
  return Array.from(match[1].matchAll(/(\d+)\s+\d+\s+R/g)).map((item) => Number(item[1]));
}

function firstRef(text, key) {
  const match = new RegExp(`\\/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(text);
  return match ? Number(match[1]) : null;
}

function parseHex(hex) {
  const clean = hex.replace(/\s+/g, '');
  const codes = [];
  for (let index = 0; index < clean.length; index += 4) {
    const unit = clean.slice(index, index + 4);
    if (unit.length === 4) codes.push(Number.parseInt(unit, 16));
  }
  return codes;
}

function hexToUnicode(hex) {
  const clean = hex.replace(/\s+/g, '');
  let output = '';
  for (let index = 0; index < clean.length; index += 4) {
    const unit = clean.slice(index, index + 4);
    if (unit.length === 4) output += String.fromCharCode(Number.parseInt(unit, 16));
  }
  return output;
}

function parseCMap(text) {
  const map = new Map();

  for (const block of text.matchAll(/beginbfchar\s*(.*?)\s*endbfchar/gs)) {
    for (const line of block[1].split(/\r?\n/)) {
      const match = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>/.exec(line);
      if (match) map.set(Number.parseInt(match[1].replace(/\s+/g, ''), 16), hexToUnicode(match[2]));
    }
  }

  for (const block of text.matchAll(/beginbfrange\s*(.*?)\s*endbfrange/gs)) {
    for (const line of block[1].split(/\r?\n/)) {
      const arrayMatch = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*\[(.*?)\]/.exec(line);
      if (arrayMatch) {
        const start = Number.parseInt(arrayMatch[1].replace(/\s+/g, ''), 16);
        const values = Array.from(arrayMatch[3].matchAll(/<([0-9A-Fa-f\s]+)>/g));
        values.forEach((value, offset) => map.set(start + offset, hexToUnicode(value[1])));
        continue;
      }

      const rangeMatch = /<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>/.exec(line);
      if (!rangeMatch) continue;
      const start = Number.parseInt(rangeMatch[1].replace(/\s+/g, ''), 16);
      const end = Number.parseInt(rangeMatch[2].replace(/\s+/g, ''), 16);
      const base = Number.parseInt(rangeMatch[3].replace(/\s+/g, ''), 16);
      for (let code = start; code <= end; code += 1) {
        map.set(code, String.fromCharCode(base + code - start));
      }
    }
  }

  return map;
}

function decodePdfString(raw) {
  return raw
    .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
      if (escaped === 'n') return '\n';
      if (escaped === 'r') return '\r';
      if (escaped === 't') return '\t';
      if (escaped === 'b') return '\b';
      if (escaped === 'f') return '\f';
      return escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodeTextHex(hex, cmap) {
  const codes = parseHex(hex);
  return codes.map((code) => cmap?.get(code) ?? String.fromCharCode(code)).join('');
}

function decodeLiteralString(raw, cmap) {
  const decoded = decodePdfString(raw);
  if (!cmap) return decoded;

  const bytes = Array.from(decoded).map((char) => char.charCodeAt(0) & 0xff);
  const hasWideCodes = Array.from(cmap.keys()).some((code) => code > 0xff);
  if (hasWideCodes && bytes.length >= 2) {
    let output = '';
    for (let index = 0; index < bytes.length; index += 2) {
      if (index + 1 >= bytes.length) {
        output += String.fromCharCode(bytes[index]);
        break;
      }
      const code = (bytes[index] << 8) + bytes[index + 1];
      output += cmap.get(code) ?? '';
    }
    if (output.trim()) return output;
  }

  return Array.from(decoded).map((char) => {
    const code = char.charCodeAt(0);
    return cmap.get(code) ?? char;
  }).join('');
}

function decodeTextToken(token, cmap) {
  if (token.startsWith('<')) return decodeTextHex(token.slice(1, -1), cmap);
  if (token.startsWith('(')) return decodeLiteralString(token.slice(1, -1), cmap);
  return '';
}

function parseTextOperations(content, fontMaps) {
  const lines = [];
  let currentFont = null;
  let y = 0;
  let pending = '';

  function pushText(text) {
    const clean = text.replace(/\u0000/g, '').replace(/\s+/g, ' ');
    if (!clean.trim()) return;
    pending += clean;
  }

  function flush() {
    const clean = pending.trim();
    if (clean) lines.push({ y, text: clean });
    pending = '';
  }

  const tokenRegex = /\/([A-Za-z0-9_.-]+)\s+[-0-9.]+\s+Tf|([-0-9.]+)\s+([-0-9.]+)\s+Td|[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+\s+[-0-9.]+\s+([-0-9.]+)\s+([-0-9.]+)\s+Tm|T\*|(<[0-9A-Fa-f\s]+>|\((?:\\.|[^\\)])*\))\s*Tj|\[((?:<[^>]+>|\((?:\\.|[^\\)])*\)|[-0-9.\s])*)\]\s*TJ/g;
  for (const match of content.matchAll(tokenRegex)) {
    if (match[1]) {
      currentFont = match[1];
    } else if (match[2] && match[3]) {
      const deltaY = Number(match[3]);
      if (Math.abs(deltaY) > 0.1) flush();
      y += deltaY;
    } else if (match[4] && match[5]) {
      flush();
      y = Number(match[5]);
    } else if (match[0] === 'T*') {
      flush();
    } else if (match[6]) {
      pushText(decodeTextToken(match[6], fontMaps.get(currentFont)));
    } else if (match[7]) {
      const pieces = Array.from(match[7].matchAll(/<[0-9A-Fa-f\s]+>|\((?:\\.|[^\\)])*\)/g));
      pushText(pieces.map((piece) => decodeTextToken(piece[0], fontMaps.get(currentFont))).join(''));
    }
  }

  flush();
  return lines;
}

function normalizeExtractedText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return true;
      const visible = line.replace(/\s/g, '');
      if (!visible) return true;
      const controlCount = (visible.match(/[\u0000-\u001f]/g) ?? []).length;
      const letterCount = (visible.match(/[A-Za-z]/g) ?? []).length;
      const wordCount = (line.match(/[A-Za-z]{3,}/g) ?? []).length;
      if (controlCount / visible.length > 0.02) return false;
      if (line.length > 25 && letterCount / visible.length < 0.55 && wordCount < 3) return false;
      return true;
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.:%])/g, '$1')
    .replace(/OAKERExperience/g, 'OAKER Experience')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export function extractPdfText(filePath) {
  const buffer = readFileSync(filePath);
  const objects = new Map();
  for (const range of findObjectRanges(buffer)) {
    objects.set(range.id, sliceObject(buffer, range));
  }

  const objectHeaders = new Map();
  const streams = new Map();
  for (const [id, objectBuffer] of objects) {
    objectHeaders.set(id, objectHeaderText(objectBuffer));
    const stream = decodedStream(objectBuffer);
    if (stream) streams.set(id, stream);
  }

  const cmapByObject = new Map();
  for (const [id, stream] of streams) {
    const header = objectHeaders.get(id) ?? '';
    const text = stream.toString('latin1');
    if (/beginbfchar|beginbfrange/.test(text) || /\/ToUnicode\b/.test(header)) {
      cmapByObject.set(id, parseCMap(text));
    }
  }

  const fontCmapsByFontObject = new Map();
  for (const [id, header] of objectHeaders) {
    const toUnicodeRef = firstRef(header, 'ToUnicode');
    if (toUnicodeRef && cmapByObject.has(toUnicodeRef)) {
      fontCmapsByFontObject.set(id, cmapByObject.get(toUnicodeRef));
    }
  }

  const pageIds = Array.from(objectHeaders.entries())
    .filter(([, header]) => /\/Type\s*\/Page\b/.test(header))
    .map(([id]) => id)
    .sort((a, b) => a - b);

  const pageTexts = [];
  for (const pageId of pageIds) {
    const pageHeader = objectHeaders.get(pageId) ?? '';
    const resourcesRef = firstRef(pageHeader, 'Resources');
    const resourcesHeader = resourcesRef ? objectHeaders.get(resourcesRef) ?? '' : pageHeader;
    const fontRef = firstRef(resourcesHeader, 'Font');
    const fontDictionaryText = fontRef
      ? objectHeaders.get(fontRef) ?? ''
      : balancedDictionary(resourcesHeader, resourcesHeader.indexOf('/Font') + '/Font'.length).replace(/^\/Font\s*/, '');
    const fontRefs = referencesFromDictionary(fontDictionaryText);
    const fontMaps = new Map();
    for (const [name, fontObjectId] of fontRefs) {
      const cmap = fontCmapsByFontObject.get(fontObjectId);
      if (cmap) fontMaps.set(name, cmap);
    }

    const contentRefs = refsFromArray(pageHeader, 'Contents');
    const singleContentRef = firstRef(pageHeader, 'Contents');
    if (!contentRefs.length && singleContentRef) contentRefs.push(singleContentRef);
    const content = contentRefs
      .map((contentRef) => streams.get(contentRef)?.toString('latin1') ?? '')
      .filter(Boolean)
      .join('\n');

    const lines = parseTextOperations(content, fontMaps);
    if (lines.length) {
      pageTexts.push(lines.map((line) => line.text).join('\n'));
    }
  }

  return normalizeExtractedText(pageTexts.join('\n\n'));
}
