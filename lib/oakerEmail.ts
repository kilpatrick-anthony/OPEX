import nodemailer from 'nodemailer';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync, deflateSync } from 'node:zlib';
import sharp from 'sharp';
import type { OakerAnswer, OakerMode } from '@/lib/oaker';

export type OakerEmailInspection = {
  id: number;
  storeName: string;
  inspectorName: string;
  mode: OakerMode;
  score: number;
  maxScore: number;
  percentage: number;
  rating: string;
  notes: string | null;
  editReason?: string | null;
  editedAt?: string | null;
  submittedAt: string;
  responses: Array<{
    questionId: number;
    section: string;
    standard: string;
    weighting: number;
    answer: OakerAnswer;
    comments: string | null;
    photos?: string[];
  }>;
};

type PdfImage = {
  name: string;
  width: number;
  height: number;
  data: Buffer;
  filter: 'DCTDecode' | 'FlateDecode';
};

type PdfPage = {
  commands: string[];
};

type ParsedPng = {
  width: number;
  height: number;
  data: Buffer;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 42;
const BRAND_PURPLE = [0.43, 0.18, 0.56] as const;
const BRAND_GREEN = [0.06, 0.65, 0.51] as const;
const SLATE_900 = [0.06, 0.09, 0.16] as const;
const SLATE_600 = [0.29, 0.33, 0.41] as const;
const SLATE_100 = [0.95, 0.97, 0.98] as const;
const WHITE = [1, 1, 1] as const;
const PDF_PHOTO_MAX_WIDTH = 720;
const PDF_PHOTO_QUALITY = 68;
const PDF_THUMB_WIDTH = 136;
const PDF_THUMB_HEIGHT = 104;
const PDF_THUMB_GAP = 12;
const PDF_THUMB_ROW_HEIGHT = 120;

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set to send email.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

type OakerEmailSendResult = {
  sent: boolean;
  provider?: 'smtp';
  recipientCount: number;
  reason?: string;
  accepted?: string[];
  rejected?: string[];
  messageId?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pdfString(value: string) {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function wrapText(text: string, maxLength = 92) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function wrapTextForWidth(text: string, width: number, fontSize: number) {
  return wrapText(text, Math.max(18, Math.floor(width / (fontSize * 0.52))));
}

function num(value: number) {
  return Number(value.toFixed(3)).toString();
}

function color(values: readonly number[]) {
  return values.map(num).join(' ');
}

function rect(page: PdfPage, x: number, y: number, width: number, height: number, fill: readonly number[]) {
  page.commands.push(`${color(fill)} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re f`);
}

function strokeRect(page: PdfPage, x: number, y: number, width: number, height: number, stroke: readonly number[]) {
  page.commands.push(`${color(stroke)} RG ${num(x)} ${num(y)} ${num(width)} ${num(height)} re S`);
}

function text(
  page: PdfPage,
  value: string,
  x: number,
  y: number,
  options: { size?: number; bold?: boolean; fill?: readonly number[] } = {},
) {
  const size = options.size ?? 10;
  const font = options.bold ? 'F2' : 'F1';
  const fill = options.fill ?? SLATE_900;
  page.commands.push(`BT /${font} ${num(size)} Tf ${color(fill)} rg ${num(x)} ${num(y)} Td (${pdfString(value)}) Tj ET`);
}

const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 222,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 222,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

const HELVETICA_BOLD_WIDTHS: Record<string, number> = {
  ...HELVETICA_WIDTHS,
  '!': 333, '"': 474, '&': 722, "'": 238, '*': 389, '-': 333, ':': 333, ';': 333, '?': 611, '@': 975,
  A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 611, l: 278, m: 889,
  n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
  '|': 280,
};

function textWidth(value: string, size: number, bold = false) {
  const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  return Array.from(value).reduce((total, character) => total + (widths[character] ?? 556), 0) * (size / 1000);
}

function textRight(
  page: PdfPage,
  value: string,
  rightX: number,
  y: number,
  options: { size?: number; bold?: boolean; fill?: readonly number[] } = {},
) {
  const size = options.size ?? 10;
  text(page, value, rightX - textWidth(value, size, options.bold), y, options);
}

function image(page: PdfPage, name: string, x: number, y: number, width: number, height: number) {
  page.commands.push(`q ${num(width)} 0 0 ${num(height)} ${num(x)} ${num(y)} cm /${name} Do Q`);
}

function answerLabel(answer: OakerAnswer) {
  if (answer === 'yes') return 'Yes';
  if (answer === 'no') return 'No';
  if (answer === 'not_applicable') return 'Not applicable';
  return 'Capex';
}

function answerColor(answer: OakerAnswer) {
  if (answer === 'yes') return [0.06, 0.65, 0.51] as const;
  if (answer === 'no') return [0.9, 0.11, 0.23] as const;
  if (answer === 'not_applicable') return [0.39, 0.45, 0.55] as const;
  return [0.96, 0.62, 0.04] as const;
}

function ratingColor(rating: string) {
  if (rating === 'Green') return [0.06, 0.65, 0.51] as const;
  if (rating === 'Amber') return [0.96, 0.62, 0.04] as const;
  if (rating === 'Red') return [0.9, 0.11, 0.23] as const;
  return BRAND_PURPLE;
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), data: Buffer.from(match[2], 'base64') };
}

function parseJpegDimensions(data: Buffer) {
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) break;
    const marker = data[offset + 1];
    const length = data.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function parsePng(data: Buffer): ParsedPng | null {
  const signature = data.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      const interlace = chunk[12];
      if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) return null;
    }
    if (type === 'IDAT') idat.push(chunk);
    if (type === 'IEND') break;
    offset += length + 12;
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const rgb = Buffer.alloc(width * height * 3);
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  let rawOffset = 0;
  let rgbOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    raw.copy(current, 0, rawOffset, rawOffset + stride);
    rawOffset += stride;

    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? current[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      if (filter === 1) current[i] = (current[i] + left) & 255;
      if (filter === 2) current[i] = (current[i] + up) & 255;
      if (filter === 3) current[i] = (current[i] + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) current[i] = (current[i] + paethPredictor(left, up, upLeft)) & 255;
    }

    for (let x = 0; x < width; x += 1) {
      const pixel = x * channels;
      const alpha = colorType === 6 ? current[pixel + 3] / 255 : 1;
      rgb[rgbOffset] = Math.round(current[pixel] * alpha + 255 * (1 - alpha));
      rgb[rgbOffset + 1] = Math.round(current[pixel + 1] * alpha + 255 * (1 - alpha));
      rgb[rgbOffset + 2] = Math.round(current[pixel + 2] * alpha + 255 * (1 - alpha));
      rgbOffset += 3;
    }

    current.copy(previous);
  }

  return { width, height, data: deflateSync(rgb) };
}

function createImageFromBuffer(name: string, data: Buffer, mime?: string): PdfImage | null {
  if (mime?.includes('jpeg') || mime?.includes('jpg') || data.subarray(0, 2).toString('hex') === 'ffd8') {
    const dimensions = parseJpegDimensions(data);
    if (!dimensions) return null;
    return { name, width: dimensions.width, height: dimensions.height, data, filter: 'DCTDecode' };
  }

  if (mime?.includes('png') || data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    const png = parsePng(data);
    if (!png) return null;
    return { name, width: png.width, height: png.height, data: png.data, filter: 'FlateDecode' };
  }

  return null;
}

async function createEvidenceImage(name: string, data: Buffer): Promise<PdfImage | null> {
  try {
    const resized = await sharp(data, { failOn: 'none' })
      .rotate()
      .resize({
        width: PDF_PHOTO_MAX_WIDTH,
        height: PDF_PHOTO_MAX_WIDTH,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: PDF_PHOTO_QUALITY, mozjpeg: true })
      .toBuffer();
    return createImageFromBuffer(name, resized, 'image/jpeg');
  } catch (err) {
    console.error('Failed to prepare OAKER PDF evidence image:', err);
    return null;
  }
}

async function loadLogoImage(): Promise<PdfImage | null> {
  const logoPath = join(process.cwd(), 'public', 'oakberry-logo.png');
  if (!existsSync(logoPath)) return null;
  try {
    const prepared = await sharp(readFileSync(logoPath), { failOn: 'none' })
      .flatten({ background: { r: 110, g: 46, b: 143 } })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return createImageFromBuffer('Logo', prepared, 'image/jpeg');
  } catch (err) {
    console.error('Failed to prepare OAKER PDF logo:', err);
    return null;
  }
}

function addHeader(page: PdfPage, inspection: OakerEmailInspection, logo?: PdfImage | null) {
  rect(page, 0, 704, PAGE_WIDTH, 88, BRAND_PURPLE);
  rect(page, 0, 704, PAGE_WIDTH, 5, BRAND_GREEN);
  if (logo) image(page, logo.name, MARGIN, 733, 150, 30);
  else text(page, 'OAKBERRY', MARGIN, 739, { size: 20, bold: true, fill: WHITE });
  textRight(page, inspection.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience', PAGE_WIDTH - MARGIN, 748, { size: 13, bold: true, fill: WHITE });
  textRight(page, `${inspection.storeName} | ${inspection.percentage.toFixed(1)}% | ${inspection.rating}`, PAGE_WIDTH - MARGIN, 728, { size: 11, bold: true, fill: WHITE });
}

function addFooter(page: PdfPage, pageNumber: number, inspection: OakerEmailInspection) {
  const submittedDate = new Date(inspection.submittedAt).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  text(page, `${inspection.storeName} | ${inspection.percentage.toFixed(1)}% ${inspection.rating} | ${submittedDate}`, MARGIN, 24, { size: 8, fill: SLATE_600 });
  text(page, `Page ${pageNumber}`, PAGE_WIDTH - MARGIN - 38, 24, { size: 8, fill: SLATE_600 });
}

async function buildStyledPdf(inspection: OakerEmailInspection) {
  const submittedAt = new Date(inspection.submittedAt).toLocaleString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const pages: PdfPage[] = [];
  const images = new Map<string, PdfImage>();
  const logo = await loadLogoImage();
  if (logo) images.set(logo.name, logo);
  let imageCount = logo ? 1 : 0;

  function addPage() {
    const page = { commands: [] as string[] };
    pages.push(page);
    addHeader(page, inspection, logo);
    addFooter(page, pages.length, inspection);
    return page;
  }

  async function addPhoto(dataUrl: string) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    imageCount += 1;
    const pdfImage = await createEvidenceImage(`Photo${imageCount}`, parsed.data);
    if (!pdfImage) return null;
    images.set(pdfImage.name, pdfImage);
    return pdfImage;
  }

  let page = addPage();
  let y = 662;

  text(page, inspection.storeName, MARGIN, y, { size: 26, bold: true, fill: SLATE_900 });
  y -= 25;
  text(page, `${inspection.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience'} completed by ${inspection.inspectorName}`, MARGIN, y, { size: 11, fill: SLATE_600 });
  y -= 17;
  text(page, submittedAt, MARGIN, y, { size: 10, fill: SLATE_600 });
  y -= 88;

  const cardW = 160;
  const cardH = 74;
  const cardGap = 24;
  const cards = [
    { label: 'Score', value: `${inspection.percentage.toFixed(1)}%`, fill: ratingColor(inspection.rating) },
    { label: 'Rating', value: inspection.rating, fill: ratingColor(inspection.rating) },
    { label: 'Points', value: `${inspection.score}/${inspection.maxScore}`, fill: BRAND_PURPLE },
  ];
  cards.forEach((card, index) => {
    const x = MARGIN + index * (cardW + cardGap);
    rect(page, x, y, cardW, cardH, card.fill);
    text(page, card.label, x + 14, y + 48, { size: 9, bold: true, fill: WHITE });
    text(page, card.value, x + 14, y + 18, { size: 23, bold: true, fill: WHITE });
  });
  y -= 42;

  const overallNotes = inspection.notes?.trim() ?? '';
  const editReason = inspection.editReason?.trim() ?? '';
  if (overallNotes || editReason) {
    y -= 34;
    const notePanelTop = y;
    const notePanelBottomLimit = 82;
    const noteLineHeight = 13;
    const noteLines = overallNotes ? wrapTextForWidth(overallNotes, PAGE_WIDTH - MARGIN * 2 - 28, 9) : [];
    const editReasonPrefix = inspection.editedAt
      ? `Edited ${new Date(inspection.editedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}: `
      : '';
    const editReasonLines = editReason ? wrapTextForWidth(`${editReasonPrefix}${editReason}`, PAGE_WIDTH - MARGIN * 2 - 28, 9) : [];
    const availableNoteHeight = notePanelTop - notePanelBottomLimit;
    const sectionGap = overallNotes && editReason ? 28 : 0;
    const headingHeight = overallNotes ? 34 : 0;
    const editHeadingHeight = editReason ? 24 : 0;
    const maxTotalLines = Math.max(3, Math.floor((availableNoteHeight - 42 - headingHeight - editHeadingHeight - sectionGap) / noteLineHeight));
    const maxNoteLines = editReason ? Math.ceil(maxTotalLines / 2) : maxTotalLines;
    const renderedNoteLines = noteLines.slice(0, maxNoteLines);
    const renderedEditReasonLines = editReasonLines.slice(0, Math.max(2, maxTotalLines - renderedNoteLines.length));
    const notePanelHeight = Math.min(
      availableNoteHeight,
      34 +
        (overallNotes ? 22 + renderedNoteLines.length * noteLineHeight : 0) +
        (editReason ? editHeadingHeight + renderedEditReasonLines.length * noteLineHeight : 0) +
        sectionGap,
    );
    const notePanelY = notePanelTop - notePanelHeight;

    rect(page, MARGIN, notePanelY, PAGE_WIDTH - MARGIN * 2, notePanelHeight, SLATE_100);
    let noteTextY = notePanelTop - 28;
    if (overallNotes) {
      text(page, 'Overall report notes', MARGIN + 14, noteTextY, { size: 12, bold: true, fill: SLATE_900 });
      renderedNoteLines.forEach((line, index) => {
        text(page, line, MARGIN + 14, noteTextY - 22 - index * noteLineHeight, { size: 9, fill: SLATE_600 });
      });
      noteTextY -= 22 + renderedNoteLines.length * noteLineHeight + sectionGap;
    }
    if (editReason) {
      text(page, 'Reason for edit', MARGIN + 14, noteTextY, { size: 12, bold: true, fill: BRAND_PURPLE });
      renderedEditReasonLines.forEach((line, index) => {
        text(page, line, MARGIN + 14, noteTextY - 22 - index * noteLineHeight, { size: 9, fill: SLATE_600 });
      });
    }
    y = notePanelY - 24;
  }

  const grouped = inspection.responses.reduce<Record<string, typeof inspection.responses>>((acc, response) => {
    if (!acc[response.section]) acc[response.section] = [];
    acc[response.section].push(response);
    return acc;
  }, {});

  const groupedEntries = Object.entries(grouped);
  if (groupedEntries.length > 0) {
    page = addPage();
    y = 660;
  }

  let sectionIndex = 0;
  for (const [section, responses] of groupedEntries) {
    if (sectionIndex > 0 || y < 135) {
      page = addPage();
      y = 660;
    }
    sectionIndex += 1;
    rect(page, MARGIN, y, PAGE_WIDTH - MARGIN * 2, 28, BRAND_PURPLE);
    text(page, section, MARGIN + 12, y + 9, { size: 11, bold: true, fill: WHITE });
    y -= 18;

    for (const response of responses) {
      const photoImages = (await Promise.all((response.photos ?? []).slice(0, 4).map(addPhoto))).filter((item): item is PdfImage => Boolean(item));
      const hasPhotos = photoImages.length > 0;
      const photoBlockW = photoImages.length === 1 ? PDF_THUMB_WIDTH : PDF_THUMB_WIDTH * 2 + PDF_THUMB_GAP;
      const textWidth = hasPhotos ? PAGE_WIDTH - MARGIN * 2 - photoBlockW - 42 : 392;
      const standardLines = wrapTextForWidth(response.standard, textWidth, 9);
      const commentLines = response.comments?.trim() ? wrapTextForWidth(`Comment: ${response.comments.trim()}`, textWidth, 8) : [];
      const photoRows = photoImages.length > 0 ? Math.ceil(photoImages.length / 2) : 0;
      const rowHeight = Math.max(76, 46 + standardLines.length * 12 + commentLines.length * 11 + photoRows * PDF_THUMB_ROW_HEIGHT);

      if (y - rowHeight < 55) {
        page = addPage();
        y = 660;
      }

      rect(page, MARGIN, y - rowHeight, PAGE_WIDTH - MARGIN * 2, rowHeight - 8, [0.99, 0.99, 1]);
      strokeRect(page, MARGIN, y - rowHeight, PAGE_WIDTH - MARGIN * 2, rowHeight - 8, [0.88, 0.91, 0.95]);
      text(page, `#${response.questionId}`, MARGIN + 12, y - 25, { size: 9, bold: true, fill: SLATE_600 });
      const labelWidth = response.answer === 'not_applicable' ? 82 : 58;
      rect(page, MARGIN + 54, y - 34, labelWidth, 20, answerColor(response.answer));
      text(page, answerLabel(response.answer), MARGIN + 64, y - 28, { size: 8, bold: true, fill: WHITE });
      const scoreText = response.answer === 'not_applicable' ? 'Score removed' : `${response.weighting} pts`;
      textRight(page, scoreText, PAGE_WIDTH - MARGIN - 12, y - 25, { size: 8, bold: true, fill: SLATE_600 });

      standardLines.forEach((line, index) => {
        text(page, line, MARGIN + 12, y - 50 - index * 12, { size: 9, fill: SLATE_900 });
      });
      let textY = y - 52 - standardLines.length * 12;
      commentLines.forEach((line, index) => {
        text(page, line, MARGIN + 12, textY - index * 11, { size: 8, fill: SLATE_600 });
      });
      textY -= commentLines.length * 11;

      photoImages.forEach((photo, index) => {
        const thumbW = PDF_THUMB_WIDTH;
        const thumbH = PDF_THUMB_HEIGHT;
        const blockW = photoImages.length === 1 ? thumbW : thumbW * 2 + PDF_THUMB_GAP;
        const blockX = PAGE_WIDTH - MARGIN - 12 - blockW;
        const blockY = y - rowHeight + 12;
        const col = index % 2;
        const rowFromTop = Math.floor(index / 2);
        const rowFromBottom = photoRows - 1 - rowFromTop;
        const x = blockX + col * (thumbW + PDF_THUMB_GAP);
        const photoY = blockY + rowFromBottom * PDF_THUMB_ROW_HEIGHT;
        rect(page, x, photoY, thumbW, thumbH, WHITE);
        strokeRect(page, x, photoY, thumbW, thumbH, [0.88, 0.91, 0.95]);
        const scale = Math.min(thumbW / photo.width, thumbH / photo.height);
        const drawW = photo.width * scale;
        const drawH = photo.height * scale;
        image(page, photo.name, x + (thumbW - drawW) / 2, photoY + (thumbH - drawH) / 2, drawW, drawH);
      });

      y -= rowHeight;
    }
    y -= 10;
  }

  return buildPdf(pages, Array.from(images.values()));
}

function buildPdf(pages: PdfPage[], images: PdfImage[]) {
  const objects: Array<string | Buffer> = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const imageObjectIds = new Map<string, number>();
  for (const pdfImage of images) {
    const objectId = objects.length + 1;
    imageObjectIds.set(pdfImage.name, objectId);
    const colorSpace = '/DeviceRGB';
    const decodeParms = pdfImage.filter === 'FlateDecode' ? '' : '';
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${pdfImage.width} /Height ${pdfImage.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /${pdfImage.filter}${decodeParms} /Length ${pdfImage.data.length} >>\nstream\n`, 'utf8'),
      pdfImage.data,
      Buffer.from('\nendstream', 'utf8'),
    ]));
  }

  const pageObjectIds: number[] = [];
  for (const page of pages) {
    const content = page.commands.join('\n');
    const contentObjectId = objects.length + 2;
    const pageObjectId = objects.length + 1;
    pageObjectIds.push(pageObjectId);
    const xObjects = images.map((pdfImage) => `/${pdfImage.name} ${imageObjectIds.get(pdfImage.name)} 0 R`).join(' ');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xObjects} >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(parts).length);
    parts.push(Buffer.from(`${index + 1} 0 obj\n`, 'utf8'));
    parts.push(Buffer.isBuffer(object) ? object : Buffer.from(object, 'utf8'));
    parts.push(Buffer.from('\nendobj\n', 'utf8'));
  });
  const xrefOffset = Buffer.concat(parts).length;
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n`, 'utf8'));
  parts.push(Buffer.from('0000000000 65535 f \n', 'utf8'));
  offsets.slice(1).forEach((offset) => {
    parts.push(Buffer.from(`${String(offset).padStart(10, '0')} 00000 n \n`, 'utf8'));
  });
  parts.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`, 'utf8'));

  return Buffer.concat(parts);
}

export async function buildOakerCheckPdf(inspection: OakerEmailInspection) {
  return buildStyledPdf(inspection);
}

export async function sendOakerCheckCompletedEmail(
  inspection: OakerEmailInspection,
  recipients: { name: string; email: string }[],
): Promise<OakerEmailSendResult> {
  if (recipients.length === 0) {
    return { sent: false, recipientCount: 0, reason: 'no_recipients' };
  }

  const from = process.env.SMTP_FROM ?? `OAKBERRY OPEX <${process.env.SMTP_USER}>`;
  const subject = `OAKER Experience Check Completed - ${inspection.storeName} - ${inspection.percentage.toFixed(1)}%`;
  const appUrl = process.env.NEXTAUTH_URL ?? 'https://opex.oakberry.ie';
  const modeLabel = inspection.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience';
  const submittedAt = new Date(inspection.submittedAt).toLocaleString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const submittedDate = new Date(inspection.submittedAt).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p style="margin:0 0 12px;font-size:15px;">A new OAKER Experience check has been completed.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Store</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.storeName)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Check type</td><td style="padding: 6px 0; font-weight: 600;">${modeLabel}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Inspector</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.inspectorName)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Score</td><td style="padding: 6px 0; font-weight: 600;">${inspection.percentage.toFixed(1)}% (${inspection.score} of ${inspection.maxScore})</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Rating</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.rating)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Submitted</td><td style="padding: 6px 0; font-weight: 600;">${submittedAt}</td></tr>
      </table>
      <p style="margin-top:18px;">The PDF report is attached.</p>
      <p><a href="${appUrl.replace(/\/$/, '')}/oaker" style="display:inline-block;background:#6d2f8e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Open OAKER Dashboard</a></p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(inspection.storeName)} | ${inspection.percentage.toFixed(1)}% ${escapeHtml(inspection.rating)} | ${submittedDate}</p>
    </div>
  `;

  const pdf = await buildOakerCheckPdf(inspection);
  const filename = `oaker-check-${inspection.id}-${inspection.storeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  const transport = getTransport();

  const sendInfo = await transport.sendMail({
    from,
    to: recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join(', '),
    subject,
    html,
    attachments: [
      {
        filename,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  });

  const accepted = Array.isArray(sendInfo.accepted) ? sendInfo.accepted.map(String) : [];
  const rejected = Array.isArray(sendInfo.rejected) ? sendInfo.rejected.map(String) : [];
  const sent = accepted.length > 0 && rejected.length === 0;

  return {
    sent,
    provider: 'smtp',
    recipientCount: recipients.length,
    reason: sent ? undefined : accepted.length > 0 ? 'partially_rejected' : 'all_rejected',
    accepted,
    rejected,
    messageId: typeof sendInfo.messageId === 'string' ? sendInfo.messageId : undefined,
  };
}
