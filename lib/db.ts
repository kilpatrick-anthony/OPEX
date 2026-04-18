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
  title: string | null;
  storeId: number | null;
};

export type RequestRecord = {
  id: number;
  storeId: number;
  storeName: string;
  userId: number;
  requesterName: string;
  requesterRole?: string;
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

const REQUEST_SELECT = `
  r.id,
  r.storeid as "storeId",
  r.userid as "userId",
  r.category,
  r.amount,
  r.description,
  r.receipt,
  r.status,
  r.querycomment as "queryComment",
  r.actioncomment as "actionComment",
  r.updatedat as "updatedAt",
  r.createdat as "createdAt"
`;

export async function ensureSchema() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, title TEXT, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`;
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

export async function updateUserPassword(userId: number, passwordHash: string) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE users SET password = ${passwordHash} WHERE id = ${userId}`;
}

export async function createUser(data: { name: string; email: string; password: string; role: 'employee' | 'manager' | 'director' | 'super_admin'; title?: string | null; storeId: number | null }) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`INSERT INTO users (name, email, password, role, title, storeId) VALUES (${data.name}, ${data.email.toLowerCase()}, ${data.password}, ${data.role}, ${data.title ?? null}, ${data.storeId}) RETURNING *`;
  return result[0] as User;
}

export async function getStores() {
  await ensureSchemaOnce();
  const sql = getSql();

  const result = await sql`SELECT * FROM stores ORDER BY id`;
  return result as Store[];
}

export async function getStoreByName(name: string) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT * FROM stores WHERE LOWER(name) = ${name.toLowerCase()} LIMIT 1`;
  return result[0] as Store | undefined;
}

export async function updateUserStoreAssignment(userId: number, storeId: number | null) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE users SET storeId = ${storeId} WHERE id = ${userId}`;
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
  const result = await sql.query(
    `SELECT ${REQUEST_SELECT}, s.name as "storeName", u.name as "requesterName", u.role as "requesterRole"
     FROM requests r
    JOIN stores s ON r.storeid = s.id
    JOIN users u ON r.userid = u.id
     WHERE r.id = $1`,
    [id],
  );
  return result[0] as RequestRecord | undefined;
}

export async function queryRequests(filters: { storeId?: number; status?: string; userId?: number; role: string; userStoreId?: number | null; requesterRole?: string }): Promise<RequestRecord[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const isManager = filters.role === 'manager';
  const userStoreId = filters.userStoreId ?? null;
  const storeId = filters.storeId ?? null;
  const status = filters.status ?? null;
  const requesterRole = filters.requesterRole ?? null;

  const result = await sql.query(
    `SELECT ${REQUEST_SELECT}, s.name as "storeName", u.name as "requesterName", u.role as "requesterRole"
     FROM requests r
     JOIN stores s ON r.storeid = s.id
     JOIN users u ON r.userid = u.id
     WHERE ($1 = false OR r.storeid = $2)
       AND ($3::int IS NULL OR r.storeid = $3)
       AND ($4::text IS NULL OR r.status = $4)
       AND ($5::text IS NULL OR u.role = $5)
     ORDER BY r.createdat DESC`,
    [isManager, userStoreId, storeId, status, requesterRole],
  );
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
  const topExpenses = await sql.query(
    `SELECT ${REQUEST_SELECT}, s.name as "storeName", u.name as "requesterName"
     FROM requests r
     JOIN stores s ON r.storeid = s.id
     JOIN users u ON r.userid = u.id
     WHERE r.status = 'approved'
       AND r.createdat >= (DATE_TRUNC('month', CURRENT_DATE) - ($1::interval))
       AND r.createdat < (DATE_TRUNC('month', CURRENT_DATE) - ($1::interval) + ($2::interval))
     ORDER BY r.amount DESC
     LIMIT 5`,
    [periodEndOffset, periodInterval],
  );

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
