import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, title TEXT, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS budget REAL NOT NULL DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, receipt TEXT, submitterName TEXT, submitterJobRole TEXT, status TEXT NOT NULL DEFAULT 'pending', queryComment TEXT, actionComment TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS submitterName TEXT`;
  await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS submitterJobRole TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, requestId INTEGER NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, comment TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, userId INTEGER NOT NULL, requestId INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, isRead BOOLEAN NOT NULL DEFAULT false, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (id SERIAL PRIMARY KEY, userId INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expiresAt TIMESTAMP NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS oaker_inspections (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, checkerName TEXT, mode TEXT NOT NULL, score REAL NOT NULL, maxScore REAL NOT NULL, percentage REAL NOT NULL, rating TEXT NOT NULL, notes TEXT, importKey TEXT, reportPath TEXT, reportText TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS oaker_responses (id SERIAL PRIMARY KEY, inspectionId INTEGER NOT NULL, questionId INTEGER NOT NULL, section TEXT NOT NULL, standard TEXT NOT NULL, weighting REAL NOT NULL, answer TEXT NOT NULL, comments TEXT, photos TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS checkerName TEXT`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS importKey TEXT`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS reportPath TEXT`;
  await sql`ALTER TABLE oaker_inspections ADD COLUMN IF NOT EXISTS reportText TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS oaker_inspections_importkey_idx ON oaker_inspections (importKey)`;
  await sql`INSERT INTO stores (name, budget) VALUES ('Warehouse', 10000) ON CONFLICT (name) DO NOTHING`;
  console.log('Schema initialized.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
