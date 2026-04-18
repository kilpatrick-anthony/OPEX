import { neon } from '@neondatabase/serverless';

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to use database operations.');
  }
  return neon(connectionString);
}

let schemaReady: Promise<void> | null = null;

export type Store = {
  id: number;
  name: string;
  budget: number;
};

export type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'employee' | 'manager' | 'director' | 'super_admin';
  storeId: number | null;
};

export type RequestRecord = {
  id: number;
  storeId: number;
  storeName: string;
  userId: number;
  requesterName: string;
  category: string;
  amount: number;
  description: string;
  receipt?: string;
  status: 'pending' | 'approved' | 'rejected' | 'queried';
  queryComment?: string;
  actionComment?: string;
  updatedAt: string;
  createdAt: string;
};

export async function ensureSchema() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, receipt TEXT, status TEXT NOT NULL DEFAULT 'pending', queryComment TEXT, actionComment TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, requestId INTEGER NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, comment TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
}

async function ensureSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }
  await schemaReady;
}

export async function getUserByEmail(email: string) {
  await ensureSchemaOnce();
  const sql = getSql();

  const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return result[0] as User | undefined;
}

export async function getUserById(id: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return result[0] as User | undefined;
}

export async function createUser(data: { name: string; email: string; password: string; role: 'employee' | 'manager' | 'director' | 'super_admin'; storeId: number | null }) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`INSERT INTO users (name, email, password, role, storeId) VALUES (${data.name}, ${data.email.toLowerCase()}, ${data.password}, ${data.role}, ${data.storeId}) RETURNING *`;
  return result[0] as User;
}

export async function getStores() {
  await ensureSchemaOnce();
  const sql = getSql();

  const result = await sql`SELECT * FROM stores ORDER BY id`;
  return result as Store[];
}

export async function insertRequest(data: {
  storeId: number;
  userId: number;
  category: string;
  amount: number;
  description: string;
  receipt?: string;
}) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`INSERT INTO requests (storeId, userId, category, amount, description, receipt, status) VALUES (${data.storeId}, ${data.userId}, ${data.category}, ${data.amount}, ${data.description}, ${data.receipt || null}, 'pending') RETURNING *`;
  return getRequestById(result[0].id);
}

export async function getRequestById(id: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id WHERE r.id = ${id}`;
  return result[0] as RequestRecord | undefined;
}

export async function queryRequests(filters: { storeId?: number; status?: string; userId?: number; role: string; userStoreId?: number | null }): Promise<RequestRecord[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const isEmployee = filters.role === 'employee';
  const isManager = filters.role === 'manager';
  const userId = filters.userId ?? null;
  const userStoreId = filters.userStoreId ?? null;
  const storeId = filters.storeId ?? null;
  const status = filters.status ?? null;

  const result = await sql`
    SELECT r.*, s.name as storeName, u.name as requesterName
    FROM requests r
    JOIN stores s ON r.storeId = s.id
    JOIN users u ON r.userId = u.id
    WHERE (${isEmployee} = false OR r.userId = ${userId})
      AND (${isManager} = false OR r.storeId = ${userStoreId})
      AND (${storeId}::int IS NULL OR r.storeId = ${storeId})
      AND (${status}::text IS NULL OR r.status = ${status})
    ORDER BY r.createdAt DESC
  `;
  return result as RequestRecord[];
}

export async function getStoreBudgets() {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT id, name, budget FROM stores ORDER BY id`;
  return result as Store[];
}

export async function getStoreRemainingBudget(storeId: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  const spent = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM requests WHERE storeId = ${storeId} AND status = 'approved' AND DATE_TRUNC('month', createdAt) = DATE_TRUNC('month', CURRENT_DATE)`;
  const store = await sql`SELECT id, name, budget FROM stores WHERE id = ${storeId}`;
  const totalSpent = Number(spent[0]?.total ?? 0);
  const storeBudget = Number(store[0]?.budget ?? 0);
  return Math.max(storeBudget - totalSpent, 0);
}

export async function performRequestAction(requestId: number, userId: number, action: 'approved' | 'rejected' | 'queried', comment?: string) {
  await ensureSchemaOnce();
  const sql = getSql();
  const validStatus = action === 'queried' ? 'queried' : action;
  await sql`UPDATE requests SET status = ${validStatus}, actionComment = ${comment || null}, queryComment = ${action === 'queried' ? comment : null}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${requestId}`;
  await sql`INSERT INTO approvals (requestId, userId, action, comment) VALUES (${requestId}, ${userId}, ${action}, ${comment || null})`;
  return getRequestById(requestId);
}

export async function getDashboardData(period: 'month' | 'last-month' | 'quarter') {
  await ensureSchemaOnce();
  const sql = getSql();
  const periodInterval = period === 'last-month' ? '1 month' : period === 'quarter' ? '3 months' : '1 month';
  const periodEndOffset = period === 'last-month' ? '1 month' : '0 month';

  const totalBudget = await sql`SELECT COALESCE(SUM(budget), 0) AS total FROM stores`;
  const totalSpent = await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM requests
    WHERE status = 'approved'
      AND createdAt >= (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval))
      AND createdAt < (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval) + (${periodInterval}::interval))
  `;
  const byStore = await sql`
    SELECT s.name, COALESCE(SUM(r.amount), 0) as total
    FROM stores s
    LEFT JOIN requests r
      ON r.storeId = s.id
      AND r.status = 'approved'
      AND r.createdAt >= (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval))
      AND r.createdAt < (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval) + (${periodInterval}::interval))
    GROUP BY s.id, s.name
    ORDER BY total DESC
  `;
  const byCategory = await sql`
    SELECT category, COALESCE(SUM(amount), 0) as total
    FROM requests
    WHERE status = 'approved'
      AND createdAt >= (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval))
      AND createdAt < (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval) + (${periodInterval}::interval))
    GROUP BY category
    ORDER BY total DESC
  `;
  const topExpenses = await sql`
    SELECT r.*, s.name as storeName, u.name as requesterName
    FROM requests r
    JOIN stores s ON r.storeId = s.id
    JOIN users u ON r.userId = u.id
    WHERE r.status = 'approved'
      AND r.createdAt >= (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval))
      AND r.createdAt < (DATE_TRUNC('month', CURRENT_DATE) - (${periodEndOffset}::interval) + (${periodInterval}::interval))
    ORDER BY r.amount DESC
    LIMIT 5
  `;

  const budgetTotal = Number(totalBudget[0]?.total ?? 0);
  const spentTotal = Number(totalSpent[0]?.total ?? 0);

  return {
    totalBudget: budgetTotal,
    totalSpent: spentTotal,
    remainingBudget: Math.max(budgetTotal - spentTotal, 0),
    byStore: byStore.map((item) => ({ name: String(item.name), total: Number(item.total) })),
    byCategory: byCategory.map((item) => ({ category: String(item.category), total: Number(item.total) })),
    topExpenses: topExpenses as RequestRecord[],
  };
}
