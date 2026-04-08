import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let cachedDb: Database | null = null;

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

export async function getDb() {
  if (cachedDb) return cachedDb;

  const db = await open({
    filename: path.join(process.cwd(), 'opex.db'),
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      storeId INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      budget REAL NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      storeId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      receipt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      queryComment TEXT,
      actionComment TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(storeId) REFERENCES stores(id),
      FOREIGN KEY(userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requestId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(requestId) REFERENCES requests(id),
      FOREIGN KEY(userId) REFERENCES users(id)
    );
  `);

  const storeCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM stores');
  if ((storeCount?.count ?? 0) === 0) {
    await db.run('INSERT INTO stores (name, budget) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)',
      'Dublin Grafton St', 15000,
      'Cork Patrick St', 12000,
      'Galway Shop St', 10000,
      'Limerick', 9000,
      'Waterford', 8000,
      'Field Team', 11000
    );
  }

  const userCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if ((userCount?.count ?? 0) === 0) {
    await db.run('INSERT INTO users (name, email, password, role, storeId) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      'Director', 'director@oakberry.ie', 'Director123!', 'director', null,
      'Grafton Manager', 'manager.dublin@oakberry.ie', 'Manager123!', 'manager', 1,
      'Cork Employee', 'employee.cork@oakberry.ie', 'Employee123!', 'employee', 2,
      'Field Employee', 'employee.field@oakberry.ie', 'Field123!', 'employee', 6
    );
  }

  cachedDb = db;
  return db;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  return db.get<User>('SELECT * FROM users WHERE email = ?', [email]);
}

export async function getUserById(id: number) {
  const db = await getDb();
  return db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
}

export async function createUser(data: { name: string; email: string; password: string; role: 'employee' | 'manager' | 'director'; storeId: number | null }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO users (name, email, password, role, storeId) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.email.toLowerCase(), data.password, data.role, data.storeId],
  );
  return getUserById(result.lastID as number);
}

export async function getStores() {
  const db = await getDb();
  return db.all<Store[]>('SELECT * FROM stores ORDER BY id');
}

export async function insertRequest(data: {
  storeId: number;
  userId: number;
  category: string;
  amount: number;
  description: string;
  receipt?: string;
}) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO requests (storeId, userId, category, amount, description, receipt, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [data.storeId, data.userId, data.category, data.amount, data.description, data.receipt || null],
  );
  return getRequestById(result.lastID as number);
}

export async function getRequestById(id: number) {
  const db = await getDb();
  return db.get<RequestRecord>(
    `SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id WHERE r.id = ?`,
    [id],
  );
}

export async function queryRequests(filters: { storeId?: number; status?: string; userId?: number; role: string; userStoreId?: number | null }): Promise<RequestRecord[]> {
  const db = await getDb();
  const params: Array<number | string> = [];
  let where = 'WHERE 1=1';

  if (filters.role === 'employee') {
    where += ' AND r.userId = ?';
    params.push(filters.userId!);
  }

  if (filters.role === 'manager') {
    where += ' AND r.storeId = ?';
    params.push(filters.userStoreId!);
  }

  if (filters.storeId) {
    where += ' AND r.storeId = ?';
    params.push(filters.storeId);
  }

  if (filters.status) {
    where += ' AND r.status = ?';
    params.push(filters.status);
  }

  return db.all(
    `SELECT r.*, s.name as storeName, u.name as requesterName FROM requests r JOIN stores s ON r.storeId = s.id JOIN users u ON r.userId = u.id ${where} ORDER BY r.createdAt DESC`,
    params,
  ) as Promise<RequestRecord[]>;
}

export async function getStoreBudgets() {
  const db = await getDb();
  return db.all<Store[]>(`SELECT id, name, budget FROM stores ORDER BY id`);
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
