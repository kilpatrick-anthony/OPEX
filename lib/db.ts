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
  actionedByName?: string | null;
  submitterName?: string | null;
  submitterJobRole?: string | null;
  updatedAt: string;
  createdAt: string;
};

export type NotificationRecord = {
  id: number;
  userId: number;
  requestId: number;
  type: 'approved' | 'rejected' | 'queried';
  title: string;
  message: string;
  isRead: boolean;
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
  r.submittername as "submitterName",
  r.submitterjobrole as "submitterJobRole",
  r.updatedat as "updatedAt",
  r.createdat as "createdAt"
`;

export async function ensureSchema() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, title TEXT, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, receipt TEXT, submitterName TEXT, submitterJobRole TEXT, status TEXT NOT NULL DEFAULT 'pending', queryComment TEXT, actionComment TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS submitterName TEXT`;
  await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS submitterJobRole TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS budget REAL NOT NULL DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, requestId INTEGER NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, comment TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, userId INTEGER NOT NULL, requestId INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, isRead BOOLEAN NOT NULL DEFAULT false, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (id SERIAL PRIMARY KEY, userId INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expiresAt TIMESTAMP NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  // Ensure Warehouse store exists
  await sql`INSERT INTO stores (name, budget) VALUES ('Warehouse', 10000) ON CONFLICT (name) DO NOTHING`;
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

export async function createNotification(data: {
  userId: number;
  requestId: number;
  type: 'approved' | 'rejected' | 'queried';
  title: string;
  message: string;
}) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`
    INSERT INTO notifications (userId, requestId, type, title, message, isRead)
    VALUES (${data.userId}, ${data.requestId}, ${data.type}, ${data.title}, ${data.message}, false)
  `;
}

export async function getNotificationsByUser(userId: number, limit = 25): Promise<NotificationRecord[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql.query(
    `SELECT
      n.id,
      n.userid as "userId",
      n.requestid as "requestId",
      n.type,
      n.title,
      n.message,
      n.isread as "isRead",
      n.createdat as "createdAt"
     FROM notifications n
     WHERE n.userid = $1
     ORDER BY n.createdat DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result as NotificationRecord[];
}

export async function getUnreadNotificationCount(userId: number): Promise<number> {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql.query(
    `SELECT COUNT(*)::int as count
     FROM notifications
     WHERE userid = $1 AND isread = false`,
    [userId],
  );
  return Number(result[0]?.count ?? 0);
}

export async function markAllNotificationsRead(userId: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE notifications SET isRead = true WHERE userId = ${userId} AND isRead = false`;
}

export async function markNotificationRead(userId: number, notificationId: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE notifications SET isRead = true WHERE id = ${notificationId} AND userId = ${userId}`;
}

export async function insertRequest(data: {
  storeId: number;
  userId: number;
  category: string;
  amount: number;
  description: string;
  receipt?: string;
  submitterName?: string;
  submitterJobRole?: string;
}) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`INSERT INTO requests (storeId, userId, category, amount, description, receipt, submitterName, submitterJobRole, status) VALUES (${data.storeId}, ${data.userId}, ${data.category}, ${data.amount}, ${data.description}, ${data.receipt || null}, ${data.submitterName || null}, ${data.submitterJobRole || null}, 'pending') RETURNING *`;
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

export async function queryRequests(filters: { storeId?: number; status?: string; userId?: number; role: string; userStoreId?: number | null; requesterRole?: string; targetUserId?: number; category?: string }): Promise<RequestRecord[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const isManager = filters.role === 'manager';
  const userStoreId = filters.userStoreId ?? null;
  const storeId = filters.storeId ?? null;
  const status = filters.status ?? null;
  const requesterRole = filters.requesterRole ?? null;
  const targetUserId = filters.targetUserId ?? null;
  const category = filters.category ?? null;

  const result = await sql.query(
    `SELECT ${REQUEST_SELECT}, s.name as "storeName", u.name as "requesterName", u.role as "requesterRole",
            au.name as "actionedByName"
     FROM requests r
     JOIN stores s ON r.storeid = s.id
     JOIN users u ON r.userid = u.id
     LEFT JOIN LATERAL (
       SELECT ap.userid FROM approvals ap WHERE ap.requestid = r.id AND ap.action IN ('approved','rejected') ORDER BY ap.createdat DESC LIMIT 1
     ) latest_ap ON true
     LEFT JOIN users au ON au.id = latest_ap.userid
     WHERE ($1 = false OR r.storeid = $2)
       AND ($3::int IS NULL OR r.storeid = $3)
       AND ($4::text IS NULL OR r.status = $4)
       AND ($5::text IS NULL OR u.role = $5)
       AND ($6::int IS NULL OR r.userid = $6)
       AND ($7::text IS NULL OR LOWER(r.category) = LOWER($7))
     ORDER BY r.createdat DESC`,
    [isManager, userStoreId, storeId, status, requesterRole, targetUserId, category],
  );
  return result as RequestRecord[];
}

export async function getStoreBudgets() {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT id, name, budget FROM stores ORDER BY id`;
  return result as Store[];
}

export async function updateStoreBudget(storeId: number, budget: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE stores SET budget = ${budget} WHERE id = ${storeId}`;
}

export async function getFieldTeamUsers() {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT id, name, title, budget FROM users WHERE role IN ('employee', 'field_team') ORDER BY name`;
  return result as { id: number; name: string; title: string | null; budget: number }[];
}

export async function getDirectorEmails(): Promise<{ name: string; email: string }[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT name, email FROM users WHERE role IN ('director', 'super_admin') ORDER BY name`;
  return result as { name: string; email: string }[];
}

export async function deleteRequest(requestId: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`DELETE FROM approvals WHERE requestId = ${requestId}`;
  await sql`DELETE FROM notifications WHERE requestId = ${requestId}`;
  await sql`DELETE FROM requests WHERE id = ${requestId}`;
}

export async function updateRequestReceipt(requestId: number, receipt: string | null) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE requests SET receipt = ${receipt}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${requestId}`;
}

export type AuditEntry = {
  id: number;
  action: string;
  comment: string | null;
  createdAt: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  requestId: number;
  requestCategory: string;
  requestAmount: number;
  storeName: string;
  requesterName: string;
};

export async function getAuditTrail(filters?: { actorId?: number; dateFrom?: string; dateTo?: string; action?: string }): Promise<AuditEntry[]> {
  await ensureSchemaOnce();
  const sql = getSql();
  const parts: string[] = [];
  const values: (string | number)[] = [];

  if (filters?.actorId) {
    values.push(filters.actorId);
    parts.push(`a.userid = $${values.length}`);
  }
  if (filters?.action) {
    values.push(filters.action);
    parts.push(`a.action = $${values.length}`);
  }
  if (filters?.dateFrom) {
    values.push(filters.dateFrom);
    parts.push(`a.createdat >= $${values.length}::timestamptz`);
  }
  if (filters?.dateTo) {
    values.push(filters.dateTo);
    parts.push(`a.createdat <= $${values.length}::timestamptz`);
  }

  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  const result = await sql.query(
    `SELECT
       a.id,
       a.action,
       a.comment,
       a.createdat AS "createdAt",
       u.id AS "actorId",
       u.name AS "actorName",
       u.role AS "actorRole",
       r.id AS "requestId",
       r.category AS "requestCategory",
       r.amount AS "requestAmount",
       s.name AS "storeName",
       ru.name AS "requesterName"
     FROM approvals a
     JOIN users u ON u.id = a.userid
     JOIN requests r ON r.id = a.requestid
     JOIN stores s ON s.id = r.storeid
     JOIN users ru ON ru.id = r.userid
     ${where}
     ORDER BY a.createdat DESC
     LIMIT 500`,
    values,
  );
  return result as AuditEntry[];
}

export async function updateUserBudget(userId: number, budget: number) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`UPDATE users SET budget = ${budget} WHERE id = ${userId}`;
}

export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
  await ensureSchemaOnce();
  const sql = getSql();
  // Remove any existing tokens for this user first
  await sql`DELETE FROM password_reset_tokens WHERE userId = ${userId}`;
  await sql`INSERT INTO password_reset_tokens (userId, token, expiresAt) VALUES (${userId}, ${token}, ${expiresAt.toISOString()})`;
}

export async function getPasswordResetToken(token: string) {
  await ensureSchemaOnce();
  const sql = getSql();
  const result = await sql`SELECT id, userid as "userId", token, expiresat as "expiresAt" FROM password_reset_tokens WHERE token = ${token} LIMIT 1`;
  return result[0] as { id: number; userId: number; token: string; expiresAt: Date } | undefined;
}

export async function deletePasswordResetToken(token: string) {
  await ensureSchemaOnce();
  const sql = getSql();
  await sql`DELETE FROM password_reset_tokens WHERE token = ${token}`;
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
