// ─── Report-specific data and helpers ────────────────────────────────────────
// Extends the existing mockData with week/year periods and reporting utilities

import {
  STORE_DETAILS, EMPLOYEE_DETAILS, ALL_STORES, ALL_EMPLOYEES,
  type RequestItem,
} from './mockData';

export type ReportPeriod = 'week' | 'month' | 'last-month' | 'quarter' | 'year';

// ─── 12-month network trend ───────────────────────────────────────────────────

export const NETWORK_TREND_12M = [
  { month: 'May 25',  total: 52400 },
  { month: 'Jun 25',  total: 55800 },
  { month: 'Jul 25',  total: 60100 },
  { month: 'Aug 25',  total: 62400 },
  { month: 'Sep 25',  total: 57600 },
  { month: 'Oct 25',  total: 61800 },
  { month: 'Nov 25',  total: 56200 },
  { month: 'Dec 25',  total: 74900 },
  { month: 'Jan 26',  total: 53800 },
  { month: 'Feb 26',  total: 58400 },
  { month: 'Mar 26',  total: 71200 },
  { month: 'Apr 26',  total: 63500 },
];

// ─── Year-level dashboard summary ────────────────────────────────────────────
// Approximated as ~3.8× quarterly data, reflecting a full financial year

const Q = 3.8;

export const YEAR_DASHBOARD = {
  totalSpent:      754000,
  totalBudget:    1140000,
  pendingCount:        34,
  pendingAmount:    18600,
  approvalRate:        87,   // %
  avgRequestSize:     1240,
  requestCount:        608,
  byStore: ALL_STORES.map((s) => ({
    name:   s.name,
    slug:   s.slug,
    total:  Math.round((STORE_DETAILS[s.slug]?.quarter.totalSpent ?? 0) * Q),
    budget: (STORE_DETAILS[s.slug]?.monthlyBudget ?? 0) * 12,
    lastMonth: STORE_DETAILS[s.slug]?.['last-month'].totalSpent ?? 0,
    thisMonth: STORE_DETAILS[s.slug]?.month.totalSpent ?? 0,
  })),
  byEmployee: ALL_EMPLOYEES.map((e) => ({
    name:      e.name,
    slug:      e.slug,
    role:      e.role,
    total:     Math.round((EMPLOYEE_DETAILS[e.slug]?.quarter.totalSpent ?? 0) * Q),
    budget:    (EMPLOYEE_DETAILS[e.slug]?.monthlyBudget ?? 0) * 12,
    thisMonth: EMPLOYEE_DETAILS[e.slug]?.month.totalSpent ?? 0,
  })),
  byCategory: [
    { category: 'Supplies',    slug: 'supplies',    total: 234000, budget: 380000 },
    { category: 'Marketing',   slug: 'marketing',   total: 171600, budget: 250000 },
    { category: 'Maintenance', slug: 'maintenance', total: 145200, budget: 180000 },
    { category: 'Travel',      slug: 'travel',      total: 100700, budget: 140000 },
    { category: 'Utilities',   slug: 'utilities',   total:  70200, budget: 100000 },
    { category: 'Equipment',   slug: 'equipment',   total:  32300, budget:  90000 },
  ],
  topExpenses: [
    { id: 3001, amount: 35800, storeName: 'Anne Street',      category: 'Marketing',    requesterName: 'Conor Walsh' },
    { id: 3010, amount: 32400, storeName: 'Cork',             category: 'Supplies',     requesterName: 'Siobhán Murphy' },
    { id: 3020, amount: 29600, storeName: 'Blanchardstown',   category: 'Maintenance',  requesterName: 'Aoife O\'Brien' },
    { id: 3030, amount: 27200, storeName: 'Arnotts',          category: 'Travel',       requesterName: 'Ciarán Ryan' },
    { id: 3040, amount: 24800, storeName: 'Swords Pavilions', category: 'Supplies',     requesterName: 'Niamh Brennan' },
  ],
};

// ─── Week-level dashboard summary ────────────────────────────────────────────
// First working week of April 2026 (Apr 1–7), approx 25% of monthly

export const WEEK_DASHBOARD = {
  totalSpent:     15900,
  totalBudget:    23750,
  pendingCount:        3,
  pendingAmount:    2570,
  approvalRate:        91,
  avgRequestSize:      820,
  requestCount:         19,
  byStore: ALL_STORES.map((s) => ({
    name:   s.name,
    slug:   s.slug,
    total:  Math.round((STORE_DETAILS[s.slug]?.month.totalSpent ?? 0) * 0.25),
    budget: Math.round((STORE_DETAILS[s.slug]?.monthlyBudget ?? 0) * 0.25),
    lastMonth: Math.round((STORE_DETAILS[s.slug]?.['last-month'].totalSpent ?? 0) * 0.25),
    thisMonth: Math.round((STORE_DETAILS[s.slug]?.month.totalSpent ?? 0) * 0.25),
  })),
  byEmployee: ALL_EMPLOYEES.map((e) => ({
    name:      e.name,
    slug:      e.slug,
    role:      e.role,
    total:     Math.round((EMPLOYEE_DETAILS[e.slug]?.month.totalSpent ?? 0) * 0.25),
    budget:    Math.round((EMPLOYEE_DETAILS[e.slug]?.monthlyBudget ?? 0) * 0.25),
    thisMonth: Math.round((EMPLOYEE_DETAILS[e.slug]?.month.totalSpent ?? 0) * 0.25),
  })),
  byCategory: [
    { category: 'Supplies',    slug: 'supplies',    total:  5200, budget:  5500 },
    { category: 'Marketing',   slug: 'marketing',   total:  3600, budget:  4200 },
    { category: 'Maintenance', slug: 'maintenance', total:  3100, budget:  3800 },
    { category: 'Travel',      slug: 'travel',      total:  2000, budget:  2600 },
    { category: 'Utilities',   slug: 'utilities',   total:  1600, budget:  2100 },
    { category: 'Equipment',   slug: 'equipment',   total:   400, budget:  1500 },
  ],
  topExpenses: [
    { id: 101,  amount: 2350, storeName: 'Anne Street',      category: 'Marketing',   requesterName: 'Conor Walsh' },
    { id: 10001, amount: 1728, storeName: 'Cork',            category: 'Maintenance', requesterName: 'Siobhán Murphy' },
    { id: 8001,  amount: 1670, storeName: 'Blanchardstown',  category: 'Maintenance', requesterName: 'Aoife O\'Brien' },
    { id: 4002,  amount: 1650, storeName: 'Arnotts',         category: 'Maintenance', requesterName: 'Ciarán Ryan' },
    { id: 25001, amount: 1392, storeName: 'Field',           category: 'Travel',      requesterName: 'Bernardo Vianna' },
  ],
};

// ─── Monthly comparison data (for MoM chart) ─────────────────────────────────

export const MOM_COMPARISON = [
  { month: 'Feb 26', thisYear: 58400, lastYear: 51200 },
  { month: 'Mar 26', thisYear: 71200, lastYear: 62800 },
  { month: 'Apr 26', thisYear: 63500, lastYear: 55400 },
];

// ─── Approval-velocity mock (avg days to decision) ───────────────────────────

export const APPROVAL_VELOCITY = [
  { category: 'Equipment',   avgDays: 3.2 },
  { category: 'Marketing',   avgDays: 2.1 },
  { category: 'Maintenance', avgDays: 1.4 },
  { category: 'Supplies',    avgDays: 1.1 },
  { category: 'Travel',      avgDays: 1.8 },
  { category: 'Utilities',   avgDays: 2.4 },
];

// ─── Budget forecast helper ───────────────────────────────────────────────────

/** Returns projected year-end spend based on a monthly average run-rate. */
export function projectYearEnd(monthlyAvgSpend: number, annualBudget: number) {
  const projected = monthlyAvgSpend * 12;
  const variance  = projected - annualBudget;
  const pct       = annualBudget > 0 ? (projected / annualBudget) * 100 : 0;
  return { projected, variance, pct };
}

// ─── Status breakdown helper ──────────────────────────────────────────────────

export function getStatusBreakdown(requests: RequestItem[]) {
  const counts:  Record<string, number> = { approved: 0, pending: 0, rejected: 0, queried: 0 };
  const amounts: Record<string, number> = { approved: 0, pending: 0, rejected: 0, queried: 0 };
  for (const req of requests) {
    counts[req.status]  = (counts[req.status]  ?? 0) + 1;
    amounts[req.status] = (amounts[req.status] ?? 0) + req.amount;
  }
  return { counts, amounts };
}

// ─── Budget health colour ─────────────────────────────────────────────────────

export function budgetHealthColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f59e0b';
  return '#10b981';
}

// ─── Period label map ─────────────────────────────────────────────────────────

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  week:         'This Week',
  month:        'This Month',
  'last-month': 'Last Month',
  quarter:      'Quarter',
  year:         'Full Year',
};
