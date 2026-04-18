import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, title TEXT, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, receipt TEXT, status TEXT NOT NULL DEFAULT 'pending', queryComment TEXT, actionComment TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, requestId INTEGER NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, comment TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, userId INTEGER NOT NULL, requestId INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, isRead BOOLEAN NOT NULL DEFAULT false, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  console.log('Schema initialized.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
