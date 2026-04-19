// Clears all test requests, approvals, and notifications without touching users or stores.
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eqIdx = t.indexOf('=');
    if (eqIdx < 1) continue;
    const key = t.slice(0, eqIdx).trim();
    const val = t.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
} catch { /* env already set */ }

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = neon(process.env.DATABASE_URL);

console.log('Clearing test data (requests, approvals, notifications)…');
await sql`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`;
console.log('  ✓ notifications cleared');
await sql`TRUNCATE TABLE approvals RESTART IDENTITY CASCADE`;
console.log('  ✓ approvals cleared');
await sql`TRUNCATE TABLE requests RESTART IDENTITY CASCADE`;
console.log('  ✓ requests cleared');
console.log('\nDone. Users and stores are untouched.');
