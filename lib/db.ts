import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

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
  role: 'employee' | 'manager' | 'director';
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

export async function getUserByEmail(email: string) {
  // Create tables if not exist
  await sql`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, storeId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS requests (id SERIAL PRIMARY KEY, storeId INTEGER NOT NULL, userId INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, receipt TEXT, status TEXT NOT NULL DEFAULT 'pending', queryComment TEXT, actionComment TEXT, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
  await sql`CREATE TABLE IF NOT EXISTS approvals (id SERIAL PRIMARY KEY, requestId INTEGER NOT NULL, userId INTEGER NOT NULL, action TEXT NOT NULL, comment TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

  // Seed users if none exist
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  if (userCount[0].count === 0) {
    await sql`INSERT INTO users (name, email, password, role, storeId) VALUES 
      ('Director', 'director@oakberry.ie', 'Director123!', 'director', null),
      ('Grafton Manager', 'manager.dublin@oakberry.ie', 'Manager123!', 'manager', 1),
      ('Cork Employee', 'employee.cork@oakberry.ie', 'Employee123!', 'employee', 2),
      ('Field Employee', 'employee.field@oakberry.ie', 'Field123!', 'employee', 6)`;
  }

  const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return result[0] as User | undefined;
}

export async function getUserById(id: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return result[0] as User | undefined;
}

export async function createUser(data: { name: string; email: string; password: string; role: 'employee' | 'manager' | 'director'; storeId: number | null }) {
  const result = await sql`INSERT INTO users (name, email, password, role, storeId) VALUES (${data.name}, ${data.email.toLowerCase()}, ${data.password}, ${data.role}, ${data.storeId}) RETURNING *`;
  return result[0] as User;
}

export async function getStores() {
  // Create table if not exist
  await sql`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, budget REAL NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;

  // Seed stores if none exist
  const storeCount = await sql`SELECT COUNT(*) as count FROM stores`;
  if (storeCount[0].count === 0) {
    await sql`INSERT INTO stores (name, budget) VALUES 
      ('Dublin Grafton St', 15000),
      ('Cork Patrick St', 12000),
      ('Galway Shop St', 10000),
      ('Limerick', 9000),
      ('Waterford', 8000),
      ('Field Team', 11000)`;
  }

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
  const result = await sql`INSERT INTO requests (storeId, userId, category, amount, description, receipt, status) VALUES (${data.storeId}, ${data.userId}, ${data.category}, ${data.amount}, ${data.description}, ${data.receipt || null}, 'pending') RETURNING *`;
  return getRequestById(result[0].id);
}

export async function getRequestById(id: number) {
  const result = await sql`SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id WHERE r.id = ${id}`;
  return result[0] as RequestRecord | undefined;
}

export async function queryRequests(filters: { storeId?: number; status?: string; userId?: number; role: string; userStoreId?: number | null }): Promise<RequestRecord[]> {
  let query = sql`SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id WHERE 1=1`;
  const conditions: any[] = [];

  if (filters.role === 'employee') {
    conditions.push(sql`r.userId = ${filters.userId}`);
  }

  if (filters.role === 'manager') {
    conditions.push(sql`r.storeId = ${filters.userStoreId}`);
  }

  if (filters.storeId) {
    conditions.push(sql`r.storeId = ${filters.storeId}`);
  }

  if (filters.status) {
    conditions.push(sql`r.status = ${filters.status}`);
  }

  if (conditions.length > 0) {
    query = sql`${query} AND ${sql.join(conditions, ' AND ')}`;
  }

  query = sql`${query} ORDER BY r.createdAt DESC`;

  const result = await query;
  return result as RequestRecord[];
}

export async function getStoreBudgets() {
  const result = await sql`SELECT id, name, budget FROM stores ORDER BY id`;
  return result as Store[];
}

export async function getStoreRemainingBudget(storeId: number) {
  const db = await getDb();
  const spent = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(amount),0) as total FROM requests WHERE storeId = ? AND status = 'approved' AND strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')`,
    [storeId],
  );
  const store = await db.get<Store>('SELECT * FROM stores WHERE id = ?', [storeId]);
  return store ? Math.max(store.budget - ((spent?.total ?? 0) || 0), 0) : 0;
}

export async function performRequestAction(requestId: number, userId: number, action: 'approved' | 'rejected' | 'queried', comment?: string) {
  const db = await getDb();
  const validStatus = action === 'queried' ? 'queried' : action;
  await db.run('UPDATE requests SET status = ?, actionComment = ?, queryComment = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [validStatus, comment || null, action === 'queried' ? comment : null, requestId]);
  await db.run('INSERT INTO approvals (requestId, userId, action, comment) VALUES (?, ?, ?, ?)', [requestId, userId, action, comment || null]);
  return getRequestById(requestId);
}

export async function getDashboardData(period: 'month' | 'last-month' | 'quarter') {
  const db = await getDb();
  let dateFilter = `strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now')`;
  if (period === 'last-month') {
    dateFilter = `strftime('%Y-%m', createdAt) = strftime('%Y-%m', 'now', '-1 month')`;
  }
  if (period === 'quarter') {
    dateFilter = `((strftime('%m', createdAt) BETWEEN strftime('%m', 'now', '-2 month') AND strftime('%m', 'now')) AND strftime('%Y', createdAt) = strftime('%Y', 'now'))`;
  }

  const totalBudget = await db.get<{ total: number }>('SELECT COALESCE(SUM(budget), 0) AS total FROM stores');
  const totalSpent = await db.get<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM requests WHERE status = 'approved' AND ${dateFilter}`);
  const byStore = await db.all<{ name: string; total: number }>(
    `SELECT s.name, COALESCE(SUM(r.amount), 0) as total FROM stores s LEFT JOIN requests r ON r.storeId = s.id AND r.status = 'approved' AND ${dateFilter} GROUP BY s.id ORDER BY total DESC`,
  );
  const byCategory = await db.all<{ category: string; total: number }>(
    `SELECT category, COALESCE(SUM(amount), 0) as total FROM requests WHERE status = 'approved' AND ${dateFilter} GROUP BY category ORDER BY total DESC`,
  );
  const topExpenses = await db.all<RequestRecord>(
    `SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id WHERE r.status = 'approved' AND ${dateFilter} ORDER BY r.amount DESC LIMIT 5`,
  );

  const budgetTotal = totalBudget?.total ?? 0;
  const spentTotal = totalSpent?.total ?? 0;

  return {
    totalBudget: budgetTotal,
    totalSpent: spentTotal,
    remainingBudget: Math.max(budgetTotal - spentTotal, 0),
    byStore,
    byCategory,
    topExpenses,
  };
}
