import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { neon } from '@neondatabase/serverless';
import { extractPdfText } from './oaker-pdf-text.mjs';

const ROOT = new URL('../', import.meta.url);
const OVERVIEW_PATH = new URL('../public/OAKER Experience Overview.xlsx', import.meta.url);
const FEB_DETAIL_PATH = new URL('../public/OPS February (The OAKER Experience).xlsx', import.meta.url);
const REPORTS_DIR = new URL('../public/Reports', import.meta.url);

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Add it to .env.local or export it before running this script.');
}

const sql = neon(process.env.DATABASE_URL);
const dryRun = process.argv.includes('--dry-run');
const NS = {
  main: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};

const MONTHS = [
  { name: 'Feb', monthIndex: 1 },
  { name: 'Mar', monthIndex: 2 },
  { name: 'Apr', monthIndex: 3 },
];

const MONTH_NAME_TO_KEY = new Map([
  ['february', 'Feb'],
  ['march', 'Mar'],
  ['april', 'Apr'],
]);

const STORE_ALIASES = new Map([
  ['blackrock', 'Blackrock'],
  ['blanchardstown', 'Blanchardstown'],
  ['mastercard', 'Mastercard'],
  ['master card', 'Mastercard'],
  ['dun laoighare', 'Dun Laoghaire'],
  ['dun laoghaire', 'Dun Laoghaire'],
  ['swords', 'Swords Main Street'],
  ['swords main street', 'Swords Main Street'],
  ['swords - main street', 'Swords Main Street'],
  ['swords pavilions', 'Swords Pavilions'],
  ['swords - pavilions', 'Swords Pavilions'],
  ['pavilions', 'Swords Pavilions'],
  ['zoo', 'Dublin Zoo'],
  ['dublin zoo', 'Dublin Zoo'],
  ['kildare village', 'Kildare Village'],
  ['ilac', 'ILAC'],
  ['arnotts', 'Arnotts'],
  ['anne street', 'South Anne Street'],
  ['south anne street', 'South Anne Street'],
  ['cork', 'Cork'],
  ['dundalk', 'Dundalk'],
  ['hansfield', 'Hansfield'],
  ['maynooth', 'Maynooth'],
  ['nutgrove', 'Nutgrove'],
]);

function loadLocalEnv() {
  const envPath = new URL('../.env.local', import.meta.url);
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function readZipEntries(pathUrl) {
  const filePath = fileURLToPath(pathUrl);
  const buffer = readFileSync(filePath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory in ${filePath}`);
    }

    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf8');

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${name}`);
    }
    const localFileNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (content && (name.endsWith('.xml') || name.endsWith('.rels'))) entries.set(name, content.toString('utf8'));

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('Could not find ZIP end of central directory.');
}

function textBetween(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, 'gs');
  return Array.from(xml.matchAll(regex)).map((match) => match[1]);
}

function stripTags(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function parseSharedStrings(entries) {
  const xml = entries.get('xl/sharedStrings.xml') ?? '';
  return textBetween(xml, 'si').map((item) => {
    const parts = Array.from(item.matchAll(/<t[^>]*>(.*?)<\/t>/gs)).map((match) => stripTags(match[1]));
    return parts.join('');
  });
}

function parseSheets(entries) {
  const workbook = entries.get('xl/workbook.xml') ?? '';
  const rels = entries.get('xl/_rels/workbook.xml.rels') ?? '';
  const relMap = new Map(
    Array.from(rels.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g))
      .map((match) => [match[1], match[2]]),
  );

  return Array.from(workbook.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g))
    .map((match) => ({
      name: stripTags(match[1]),
      path: `xl/${relMap.get(match[2])}`,
    }));
}

function parseRows(entries, sheetPath, sharedStrings) {
  const xml = entries.get(sheetPath) ?? '';
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]+r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const cellMatch of rowMatch[2].matchAll(/<c[^>]+r="([A-Z]+)\d+"([^>]*)>(.*?)<\/c>/gs)) {
      const [, col, attrs, body] = cellMatch;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const rawValue = /<v>(.*?)<\/v>/s.exec(body)?.[1];
      let value = '';
      if (rawValue !== undefined) {
        value = rawValue;
        if (type === 's') value = sharedStrings[Number(rawValue)] ?? rawValue;
      } else if (type === 'inlineStr') {
        value = Array.from(body.matchAll(/<t[^>]*>(.*?)<\/t>/gs)).map((match) => stripTags(match[1])).join('');
      }
      cells[col] = stripTags(value);
    }
    rows.push({ number: Number(rowMatch[1]), cells });
  }
  return rows;
}

function canonicalStoreName(name) {
  const clean = String(name ?? '').replace(/^OPS\s*-\s*/i, '').trim().replace(/\s+/g, ' ');
  return STORE_ALIASES.get(clean.toLowerCase()) ?? clean;
}

function excelDateToIso(value, monthIndex) {
  const text = String(value ?? '').trim();
  if (!text) return new Date(Date.UTC(2026, monthIndex, 15)).toISOString();

  const serial = Number(text);
  if (Number.isFinite(serial)) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return date.toISOString();
  }

  const rangeMatch = text.match(/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (rangeMatch) {
    const [, , day, month, year] = rangeMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString();
  }

  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString();
  }

  return new Date(Date.UTC(2026, monthIndex, 15)).toISOString();
}

function ratingFor(percentage) {
  if (percentage >= 90) return 'Green';
  if (percentage >= 75) return 'Amber';
  return 'Red';
}

function parseOverview(entries) {
  const sharedStrings = parseSharedStrings(entries);
  const sheets = parseSheets(entries);
  const overview = new Map();

  for (const month of MONTHS) {
    const sheet = sheets.find((item) => item.name === month.name);
    if (!sheet) continue;
    const rows = parseRows(entries, sheet.path, sharedStrings);
    for (const row of rows.slice(1)) {
      const location = row.cells.A;
      const scoreValue = Number(row.cells.D);
      if (!location || !Number.isFinite(scoreValue)) continue;

      const storeName = canonicalStoreName(location);
      const percentage = Math.round(scoreValue * 1000) / 10;
      const notes = [
        row.cells.E ? `Overview: ${row.cells.E}` : '',
        row.cells.F ? `Follow Up: ${row.cells.F}` : '',
      ].filter(Boolean).join('\n\n');

      overview.set(`${month.name}:${storeName.toLowerCase()}`, {
        month: month.name,
        storeName,
        inspectorName: row.cells.B || 'Layla',
        submittedAt: excelDateToIso(row.cells.C, month.monthIndex),
        score: Math.round(scoreValue * 500),
        maxScore: 500,
        percentage,
        rating: ratingFor(percentage),
        notes,
      });
    }
  }

  return overview;
}

function parseFebruaryDetail(entries) {
  const sharedStrings = parseSharedStrings(entries);
  const sheets = parseSheets(entries).filter((sheet) => sheet.name !== 'Guide');
  const details = new Map();

  for (const sheet of sheets) {
    const storeName = canonicalStoreName(sheet.name);
    const rows = parseRows(entries, sheet.path, sharedStrings);
    let currentSection = '';
    const responses = [];

    for (const row of rows) {
      const a = row.cells.A?.trim();
      const b = row.cells.B?.trim();
      if (a && !b && !/^\d+(\.0)?$/.test(a) && !a.startsWith('Question ID')) {
        currentSection = a;
      }
      if (!a || !b || !/^\d+(\.0)?$/.test(a)) continue;

      const answer = row.cells.D ? 'yes' : row.cells.E ? 'no' : row.cells.F ? 'capex' : null;
      if (!answer) continue;

      responses.push({
        questionId: Number(a),
        section: currentSection || 'OAKER Experience',
        standard: b,
        weighting: Number(row.cells.C || 0),
        answer,
        comments: row.cells.G || '',
        photos: [],
      });
    }

    if (responses.length > 0) {
      details.set(storeName.toLowerCase(), { storeName, responses });
    }
  }

  return details;
}

function parseReports() {
  if (!existsSync(REPORTS_DIR)) return new Map();
  const reports = new Map();
  const files = readdirSync(REPORTS_DIR).filter((file) => file.toLowerCase().endsWith('.pdf'));
  for (const file of files) {
    const match = file.match(/^OAKER Experience Report - (.+?)\s+(February|March|April)!?\.pdf$/i);
    if (!match) continue;
    const storeName = canonicalStoreName(match[1]);
    const month = MONTH_NAME_TO_KEY.get(match[2].toLowerCase());
    if (!month) continue;
    const filePath = fileURLToPath(new URL(`../public/Reports/${file}`, import.meta.url));
    reports.set(`${month}:${storeName.toLowerCase()}`, {
      path: `/Reports/${file}`,
      text: extractPdfText(filePath),
    });
  }
  return reports;
}

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS oaker_inspections (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, mode TEXT NOT NULL, score REAL NOT NULL, maxScore REAL NOT NULL, percentage REAL NOT NULL, rating TEXT NOT NULL, notes TEXT, importKey TEXT, reportPath TEXT, reportText TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS oaker_responses (id SERIAL PRIMARY KEY, inspectionId INTEGER NOT NULL, questionId INTEGER NOT NULL, section TEXT NOT NULL, standard TEXT NOT NULL, weighting REAL NOT NULL, answer TEXT NOT NULL, comments TEXT, photos TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS importKey TEXT`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS reportPath TEXT`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS reportText TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS oaker_inspections_importkey_idx ON oaker_inspections (importKey)`;
}

async function getOrCreateStore(name) {
  const existing = await sql`SELECT id FROM stores WHERE LOWER(name) = ${name.toLowerCase()} LIMIT 1`;
  if (existing[0]?.id) return Number(existing[0].id);
  const created = await sql`INSERT INTO stores (name, budget) VALUES (${name}, 10000) RETURNING id`;
  return Number(created[0].id);
}

async function getInspectorUserId(name) {
  const clean = String(name || '').trim().toLowerCase();
  const inspector = clean
    ? await sql`SELECT id FROM users WHERE LOWER(name) LIKE ${`%${clean}%`} ORDER BY id LIMIT 1`
    : [];
  if (inspector[0]?.id) return Number(inspector[0].id);

  const fallback = await sql`SELECT id FROM users WHERE role IN ('super_admin', 'director') ORDER BY id LIMIT 1`;
  if (fallback[0]?.id) return Number(fallback[0].id);

  throw new Error('Could not find an inspector or fallback user to attach imported OAKER checks to.');
}

async function upsertInspection(record, responses = []) {
  const storeId = await getOrCreateStore(record.storeName);
  const userId = await getInspectorUserId(record.inspectorName);
  const importKey = `oaker-history:${record.month}:${record.storeName.toLowerCase()}`;

  const result = await sql`
    INSERT INTO oaker_inspections (storeId, userId, mode, score, maxScore, percentage, rating, notes, importKey, reportPath, reportText, submittedAt, createdAt)
    VALUES (${storeId}, ${userId}, 'experience', ${record.score}, ${record.maxScore}, ${record.percentage}, ${record.rating}, ${record.notes || null}, ${importKey}, ${record.reportPath || null}, ${record.reportText || null}, ${record.submittedAt}, ${record.submittedAt})
    ON CONFLICT (importKey) DO UPDATE SET
      storeId = EXCLUDED.storeId,
      userId = EXCLUDED.userId,
      mode = EXCLUDED.mode,
      score = EXCLUDED.score,
      maxScore = EXCLUDED.maxScore,
      percentage = EXCLUDED.percentage,
      rating = EXCLUDED.rating,
      notes = EXCLUDED.notes,
      reportPath = EXCLUDED.reportPath,
      reportText = EXCLUDED.reportText,
      submittedAt = EXCLUDED.submittedAt
    RETURNING id
  `;
  const inspectionId = Number(result[0].id);
  await sql`DELETE FROM oaker_responses WHERE inspectionId = ${inspectionId}`;

  for (const response of responses) {
    await sql`
      INSERT INTO oaker_responses (inspectionId, questionId, section, standard, weighting, answer, comments, photos)
      VALUES (${inspectionId}, ${response.questionId}, ${response.section}, ${response.standard}, ${response.weighting}, ${response.answer}, ${response.comments || null}, ${JSON.stringify(response.photos || [])})
    `;
  }

  return inspectionId;
}

async function main() {
  console.log(`Reading ${basename(fileURLToPath(OVERVIEW_PATH))}...`);
  const overviewEntries = await readZipEntries(OVERVIEW_PATH);
  const overview = parseOverview(overviewEntries);

  console.log(`Reading ${basename(fileURLToPath(FEB_DETAIL_PATH))}...`);
  const detailEntries = await readZipEntries(FEB_DETAIL_PATH);
  const febDetails = parseFebruaryDetail(detailEntries);
  const reports = parseReports();

  if (dryRun) {
    const detailedCount = Array.from(overview.values()).filter((record) => record.month === 'Feb' && febDetails.has(record.storeName.toLowerCase())).length;
    const linkedCount = Array.from(overview.values()).filter((record) => reports.has(`${record.month}:${record.storeName.toLowerCase()}`)).length;
    const extractedCount = Array.from(reports.values()).filter((report) => report.text.length > 0).length;
    console.log(`Dry run: parsed ${overview.size} overview inspection rows.`);
    console.log(`Dry run: ${detailedCount} February rows have matching question-level detail.`);
    console.log(`Dry run: ${linkedCount} rows have matching original PDF reports.`);
    console.log(`Dry run: extracted readable report text from ${extractedCount} PDF reports.`);
    for (const record of Array.from(overview.values()).slice(0, 8)) {
      const responses = record.month === 'Feb' ? febDetails.get(record.storeName.toLowerCase())?.responses?.length ?? 0 : 0;
      const reportPath = reports.get(`${record.month}:${record.storeName.toLowerCase()}`)?.path ?? '';
      console.log(`${record.month} | ${record.storeName} | ${record.percentage}% | responses ${responses} | ${reportPath || 'no PDF'}`);
    }
    return;
  }

  await ensureSchema();

  let imported = 0;
  let detailed = 0;
  let linked = 0;
  let extracted = 0;
  for (const record of overview.values()) {
    const report = reports.get(`${record.month}:${record.storeName.toLowerCase()}`);
    record.reportPath = report?.path ?? null;
    record.reportText = report?.text ?? null;
    const responses = record.month === 'Feb' ? febDetails.get(record.storeName.toLowerCase())?.responses ?? [] : [];
    await upsertInspection(record, responses);
    imported += 1;
    if (responses.length > 0) detailed += 1;
    if (record.reportPath) linked += 1;
    if (record.reportText) extracted += 1;
  }

  console.log(`Imported/updated ${imported} historical OAKER inspections.`);
  console.log(`${detailed} February inspections include question-level responses.`);
  console.log(`${linked} inspections are linked to original PDF reports.`);
  console.log(`${extracted} inspections include extracted PDF report text.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
