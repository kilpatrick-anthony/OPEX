'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, startOfMonth, subMonths, startOfQuarter, startOfYear, endOfMonth } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { label: 'Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'Year', value: 'year' },
] as const;

type Period = (typeof PERIOD_OPTIONS)[number]['value'];

type StoreRow = { id: number; name: string; budget: number };
type UserRow  = { id: number; name: string; title: string | null; budget: number };

type RequestRow = {
  id: number;
  userId: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'queried';
  category: string;
  description: string;
  storeName: string;
  requesterName: string;
  createdAt: string;
  reimbursable?: boolean;
};

type DashboardPayload = {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  byStore: Array<{ name: string; total: number }>;
  byCategory: Array<{ category: string; total: number }>;
  topExpenses: Array<{
    id: number;
    amount: number;
    storeName: string;
    category: string;
    requesterName: string;
  }>;
};

const STATUS_COLORS: Record<RequestRow['status'], string> = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
  queried: '#0ea5e9',
};

const STATUS_BADGE: Record<RequestRow['status'], string> = {
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  queried: 'bg-sky-50 text-sky-700 border border-sky-200',
};

const ENTITY_PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#0284c7'];

function getPeriodRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'week': {
      const from = startOfWeek(now, { weekStartsOn: 1 });
      return { from, to: now };
    }
    case 'month':
      return { from: startOfMonth(now), to: now };
    case 'last-month': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case 'quarter':
      return { from: startOfQuarter(now), to: now };
    case 'year':
      return { from: startOfYear(now), to: now };
  }
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printPayrollReport(groups: PayrollGroup[], dateFrom: Date, dateTo: Date) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  const dateLabel = `${format(dateFrom, 'd MMM yyyy')} – ${format(dateTo, 'd MMM yyyy')}`;
  const fmt = (v: number) => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(v);
  const rows = groups.map((g) => `
    <div style="page-break-inside:avoid;margin-bottom:32px">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0ea5e9;padding-bottom:8px;margin-bottom:12px">
        <div>
          <span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b">${g.type === 'store' ? 'Store' : 'Field Team'}</span>
          <h2 style="margin:2px 0 0;font-size:18px;color:#0f172a">${g.name}</h2>
        </div>
        <div style="text-align:right">
          <span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b">Total for Reimbursement</span>
          <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#10b981">${fmt(g.total)}</p>
        </div>
      </div>
      ${g.reimbursable.length === 0 ? '<p style="color:#94a3b8;font-size:13px">No reimbursable expenses in this period.</p>' : `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0">Date</th>
          <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0">Category</th>
          <th style="padding:8px;text-align:left;border-bottom:1px solid #e2e8f0">Description</th>
          <th style="padding:8px;text-align:right;border-bottom:1px solid #e2e8f0">Amount</th>
        </tr></thead>
        <tbody>
          ${g.reimbursable.map((r, i) => `<tr style="background:${i%2===0?'#fff':'#f8fafc'}">
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${format(new Date(r.createdAt),'d MMM yyyy')}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9">${r.category}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#475569">${r.description}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${fmt(r.amount)}</td>
          </tr>`).join('')}
          <tr style="background:#f0fdf4;font-weight:700">
            <td colspan="3" style="padding:8px;border-top:2px solid #10b981">Total for Reimbursement</td>
            <td style="padding:8px;border-top:2px solid #10b981;text-align:right;color:#10b981">${fmt(g.total)}</td>
          </tr>
        </tbody>
      </table>`}
      ${g.excluded.length > 0 ? `
      <p style="margin:16px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8">Excluded from reimbursement (${g.excluded.length} item${g.excluded.length > 1 ? 's' : ''} — paid via card or other method)</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;opacity:0.6">
        <tbody>
          ${g.excluded.map((r) => `<tr>
            <td style="padding:5px 8px;color:#94a3b8;white-space:nowrap">${format(new Date(r.createdAt),'d MMM yyyy')}</td>
            <td style="padding:5px 8px;color:#94a3b8">${r.category}</td>
            <td style="padding:5px 8px;color:#94a3b8">${r.description}</td>
            <td style="padding:5px 8px;color:#94a3b8;text-align:right;text-decoration:line-through">${fmt(r.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''}
    </div>`).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>Payroll Report — ${dateLabel}</title>
    <style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#0f172a;padding:40px;max-width:860px;margin:0 auto}h1{font-size:22px;margin:0}@media print{body{padding:20px}}</style>
    </head><body>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;border-bottom:1px solid #e2e8f0;padding-bottom:20px">
      <div><p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">OPEX Payroll Report</p>
      <h1>Approved Expenses</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b">${dateLabel}</p></div>
      <p style="margin:0;font-size:11px;color:#94a3b8">Printed ${format(new Date(),'d MMM yyyy, HH:mm')}</p>
    </div>
    ${rows}
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

type PayrollGroup = {
  key: string;
  name: string;
  type: 'store' | 'employee';
  approved: RequestRow[];
  reimbursable: RequestRow[];
  excluded: RequestRow[];
  total: number;
  color: string;
};

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEntityKeys, setSelectedEntityKeys] = useState<string[]>([]);

  const [stores, setStores]       = useState<StoreRow[]>([]);
  const [fieldUsers, setFieldUsers] = useState<UserRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [requests, setRequests]   = useState<RequestRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Filters for the All Requests table
  const [tableLocationFilter, setTableLocationFilter] = useState('');
  const [tableEmployeeFilter, setTableEmployeeFilter] = useState('');

  // ── Load dashboard + all requests + entity lists ───────────────────────

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [dashRes, reqRes, storesRes, usersRes] = await Promise.all([
        fetch(`/api/dashboard?period=${period}`, { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/stores',   { cache: 'no-store' }),
        fetch('/api/users',    { cache: 'no-store' }),
      ]);

      const dashPayload   = await readJsonSafely(dashRes);
      const reqPayload    = await readJsonSafely(reqRes);
      const storesPayload = await readJsonSafely(storesRes);
      const usersPayload  = await readJsonSafely(usersRes);

      if (!dashRes.ok)  throw new Error(getApiErrorMessage(dashRes,  dashPayload,  'Failed to load dashboard data'));
      if (!reqRes.ok)   throw new Error(getApiErrorMessage(reqRes,   reqPayload,   'Failed to load requests'));

      setDashboard(dashPayload as DashboardPayload);
      setRequests(Array.isArray((reqPayload as any)?.requests) ? (reqPayload as any).requests as RequestRow[] : []);
      setStores(Array.isArray(storesPayload) ? storesPayload as StoreRow[] : []);
      setFieldUsers(Array.isArray(usersPayload) ? usersPayload as UserRow[] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [period]);

  // ── Entity selector ────────────────────────────────────────────────────

  function toggleEntity(key: string) {
    setSelectedEntityKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  // ── Effective date range ───────────────────────────────────────────────

  const { from: effectiveFrom, to: effectiveTo } = useMemo(() => {
    if (dateRange?.from) return { from: dateRange.from, to: dateRange.to ?? new Date() };
    return getPeriodRange(period);
  }, [period, dateRange]);

  // ── Requests filtered by effective date range ──────────────────────────

  const dateFilteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= effectiveFrom && d <= effectiveTo;
    });
  }, [requests, effectiveFrom, effectiveTo]);

  // ── Payroll groups (entity + date filtered, approved only) ──────────────

  const payrollGroups = useMemo<PayrollGroup[]>(() => {
    if (selectedEntityKeys.length === 0) return [];
    return selectedEntityKeys.map((key, idx) => {
      const [type, idStr] = key.split(':');
      const id = Number(idStr);
      let name = '';
      let entityRequests: RequestRow[] = [];
      if (type === 'store') {
        const store = stores.find((s) => s.id === id);
        name = store?.name ?? 'Unknown';
        entityRequests = dateFilteredRequests.filter((r) => r.storeName === (store?.name ?? ''));
      } else {
        const user = fieldUsers.find((u) => u.id === id);
        name = user?.name ?? 'Unknown';
        entityRequests = dateFilteredRequests.filter((r) => r.userId === id);
      }
      const approved = entityRequests.filter((r) => r.status === 'approved');
      const reimbursable = approved.filter((r) => r.reimbursable !== false);
      const excluded = approved.filter((r) => r.reimbursable === false);
      const total    = reimbursable.reduce((s, r) => s + r.amount, 0);
      return { key, name, type: type as 'store' | 'employee', approved, reimbursable, excluded, total, color: ENTITY_PALETTE[idx % ENTITY_PALETTE.length] };
    });
  }, [selectedEntityKeys, dateFilteredRequests, stores, fieldUsers]);

  // ── Existing chart data (period-based, all requests) ───────────────────

  const approved = useMemo(() => requests.filter((r) => r.status === 'approved'), [requests]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<RequestRow['status'], number> = { approved: 0, pending: 0, rejected: 0, queried: 0 };
    for (const req of requests) counts[req.status] += 1;
    return (Object.keys(counts) as RequestRow['status'][])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ name: s, value: counts[s], color: STATUS_COLORS[s] }));
  }, [requests]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const req of approved) {
      const key = format(new Date(req.createdAt), 'yyyy-MM');
      byMonth.set(key, (byMonth.get(key) || 0) + req.amount);
    }
    return Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([key, total]) => ({ month: key, total }));
  }, [approved]);

  // ── CSV export ─────────────────────────────────────────────────────────

  function exportCsv() {
    const rows: string[][] = [
      ['ID', 'Date', 'Store', 'Category', 'Amount', 'Status', 'Requester', 'Description'],
      ...dateFilteredRequests.map((r) => [
        String(r.id), r.createdAt, r.storeName, r.category,
        r.amount.toFixed(2), r.status, r.requesterName, r.description,
      ]),
    ];
    downloadCsv(rows, `opex-report-${period}.csv`);
  }

  // ── Table-level filters (All Requests section) ─────────────────────────

  const tableFilteredRequests = useMemo(() => {
    return dateFilteredRequests.filter((r) => {
      if (tableLocationFilter && r.storeName !== tableLocationFilter) return false;
      if (tableEmployeeFilter) {
        const uid = Number(tableEmployeeFilter);
        if (r.userId !== uid) return false;
      }
      return true;
    });
  }, [dateFilteredRequests, tableLocationFilter, tableEmployeeFilter]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50"><Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading report data...</main>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50"><Navbar />
        <main className="container py-10">
          <p className="text-sm text-rose-600">{error || 'Failed to load reports.'}</p>
          <Button className="mt-4" onClick={loadData}>Retry</Button>
        </main>
      </div>
    );
  }

  const hasPayroll = payrollGroups.length > 0;
  const payrollDateLabel = `${format(effectiveFrom, 'd MMM yyyy')} – ${format(effectiveTo, 'd MMM yyyy')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">OPEX Reporting</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Network Reports</h1>
            <p className="mt-1 text-sm text-slate-500">Live reporting from submitted requests and approved spend.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <Button key={opt.value} variant={!dateRange && opt.value === period ? 'default' : 'secondary'}
                type="button" onClick={() => { setPeriod(opt.value); setDateRange(undefined); }}>
                {opt.label}
              </Button>
            ))}
            <DateRangePicker range={dateRange} onChange={(r) => { setDateRange(r); }} />
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>

        {/* ── KPI cards ─────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total approved spend</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(dashboard.totalSpent)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Budget</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(dashboard.totalBudget)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Remaining budget</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-600">{formatCurrency(dashboard.remainingBudget)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total requests</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{requests.length}</p>
          </Card>
        </div>

        {/* ── Charts ────────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Spend by store</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.byStore}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Request status distribution</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {statusBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => String(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {statusBreakdown.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-medium capitalize text-slate-700">{entry.name}</span>
                  <span className="text-xs text-slate-400">({entry.value})</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Approved spend trend (last 12 months)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} name="Approved Spend" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Payroll Report Builder ─────────────────────────────────────── */}
        <div className="mt-12">
          {/* Section header */}
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 px-8 py-6 text-white shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-200">Step-by-step</p>
                <h2 className="mt-1 text-2xl font-bold">Payroll Report Builder</h2>
                <p className="mt-2 text-sm text-sky-100 max-w-xl">
                  Use this section to build the approved-expense summary used for payroll reimbursements.
                  Follow the steps below carefully — <strong className="text-white">select stores and team members separately</strong>.
                </p>
              </div>
              {hasPayroll && (
                <Button
                  type="button"
                  onClick={() => printPayrollReport(payrollGroups, effectiveFrom, effectiveTo)}
                  className="gap-2 bg-white text-sky-700 hover:bg-sky-50 shrink-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                  </svg>
                  Print / Save Report
                </Button>
              )}
            </div>
          </div>

          {/* Important notice */}
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
            <div className="flex gap-3">
              <span className="mt-0.5 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Important — Field Team: Enter your name only</p>
                <p className="mt-1 text-sm text-amber-700">
                  When submitting an expense request, please enter <strong>only your name</strong> in the name field.
                  Do <strong>not</strong> add your store location or area alongside your name (e.g. don&apos;t write &quot;Emma Barrett – Cork&quot;).
                  Location is captured separately via the store selector and entering it in the name field can cause duplicate or incorrect entries to appear in the payroll report.
                </p>
              </div>
            </div>
          </div>

          <Card className="divide-y divide-slate-100 overflow-hidden">

            {/* Step 1 — Date range */}
            <div className="px-8 py-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shrink-0">1</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Choose a date range</p>
                  <p className="text-xs text-slate-500">Select the pay period you want to run the report for.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button key={opt.value}
                    onClick={() => { setPeriod(opt.value); setDateRange(undefined); }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!dateRange && opt.value === period ? 'bg-sky-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {opt.label}
                  </button>
                ))}
                <DateRangePicker range={dateRange} onChange={setDateRange} />
              </div>
              <p className="mt-3 text-sm font-medium text-sky-700">
                📅 Selected period: <span className="font-semibold">{payrollDateLabel}</span>
              </p>
            </div>

            {/* Step 2 — Select entities */}
            {(stores.length > 0 || fieldUsers.length > 0) && (
              <div className="px-8 py-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shrink-0">2</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Select stores and/or team members</p>
                    <p className="text-xs text-slate-500">
                      Click each store or team member you want included. You can select multiple.
                      Use the quick-select dropdowns or click the buttons below.
                    </p>
                  </div>
                </div>

                {/* Quick filter dropdowns */}
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick select</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setSelectedEntityKeys([val]);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <option value="">Jump to a location…</option>
                    {stores.map((s) => (
                      <option key={s.id} value={`store:${s.id}`}>{s.name}</option>
                    ))}
                  </select>
                  {fieldUsers.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setSelectedEntityKeys([val]);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <option value="">Jump to a team member…</option>
                      {fieldUsers.map((u) => (
                        <option key={u.id} value={`employee:${u.id}`}>{u.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedEntityKeys([
                      ...stores.map((s) => `store:${s.id}`),
                      ...fieldUsers.map((u) => `employee:${u.id}`),
                    ])}
                    className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
                  >
                    Select all
                  </button>
                  {selectedEntityKeys.length > 0 && (
                    <button type="button" onClick={() => setSelectedEntityKeys([])}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
                      Clear selection ({selectedEntityKeys.length})
                    </button>
                  )}
                </div>

                {stores.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">🏪 Stores / Locations</p>
                    <div className="flex flex-wrap gap-2">
                      {stores.map((s) => {
                        const key = `store:${s.id}`;
                        const active = selectedEntityKeys.includes(key);
                        const idx    = selectedEntityKeys.indexOf(key);
                        return (
                          <button key={key} type="button" onClick={() => toggleEntity(key)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                            style={active ? { background: ENTITY_PALETTE[idx % ENTITY_PALETTE.length] } : {}}>
                            {active ? '✓ ' : ''}{s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {fieldUsers.length > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">👤 Field Team Members</p>
                    <p className="mb-3 text-xs text-slate-400">Select individual team members to see their personal expenses. Do not select a store AND the same person — this will double-count their expenses.</p>
                    <div className="flex flex-wrap gap-2">
                      {fieldUsers.map((u) => {
                        const key = `employee:${u.id}`;
                        const active = selectedEntityKeys.includes(key);
                        const idx    = selectedEntityKeys.indexOf(key);
                        return (
                          <button key={key} type="button" onClick={() => toggleEntity(key)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                            style={active ? { background: ENTITY_PALETTE[idx % ENTITY_PALETTE.length] } : {}}>
                            {active ? '✓ ' : ''}{u.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Preview */}
            <div className="px-8 py-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shrink-0">3</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Review and print</p>
                  <p className="text-xs text-slate-500">Check the breakdown below, then use the &quot;Print / Save Report&quot; button above to export.</p>
                </div>
              </div>

            {!hasPayroll && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
                <p className="text-2xl">👆</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Select at least one store or team member in Step 2 to generate a preview.</p>
              </div>
            )}

            {hasPayroll && (
              <div className="space-y-4">
                {/* Summary totals bar */}
                <div className="flex flex-wrap gap-3 rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4">
                  <div className="mr-auto">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total for reimbursement</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(payrollGroups.reduce((s, g) => s + g.total, 0))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Period</p>
                    <p className="text-sm font-semibold text-slate-700">{payrollDateLabel}</p>
                  </div>
                </div>

                {payrollGroups.map((g) => (
              <div key={g.key} className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4" style={{ borderLeft: `4px solid ${g.color}` }}>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">
                      {g.type === 'store' ? 'Store' : 'Field Team'}
                    </span>
                    <span className="font-semibold text-slate-900">{g.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">For reimbursement</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(g.total)}</p>
                  </div>
                </div>
                {g.reimbursable.length === 0 && g.excluded.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No approved expenses in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <tr>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Category</th>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </TableHeader>
                      <tbody>
                        {g.reimbursable.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                              {format(new Date(r.createdAt), 'd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">{r.category}</span>
                            </TableCell>
                            <TableCell className="max-w-xs text-sm text-slate-600">{r.description}</TableCell>
                            <TableCell className="text-right font-semibold text-slate-900">{formatCurrency(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                        {g.excluded.map((r) => (
                          <TableRow key={r.id} className="opacity-40">
                            <TableCell className="text-sm text-slate-400 whitespace-nowrap line-through">
                              {format(new Date(r.createdAt), 'd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400 line-through">{r.category}</span>
                            </TableCell>
                            <TableCell className="max-w-xs text-sm text-slate-400 line-through">{r.description}</TableCell>
                            <TableCell className="text-right text-sm text-slate-400 line-through">{formatCurrency(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} className="font-semibold text-slate-700">
                            Total for reimbursement
                            {g.excluded.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({g.excluded.length} item{g.excluded.length > 1 ? 's' : ''} excluded)</span>}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(g.total)}</TableCell>
                        </TableRow>
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
              </div>
            )}
            </div>
          </Card>
        </div>

        {/* ── All requests table ─────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-500">
                  All requests
                  {dateRange?.from && <span className="ml-2 text-xs font-normal normal-case text-slate-400">({payrollDateLabel})</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={tableLocationFilter}
                  onChange={(e) => { setTableLocationFilter(e.target.value); setTableEmployeeFilter(''); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">All locations</option>
                  {stores.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <select
                  value={tableEmployeeFilter}
                  onChange={(e) => { setTableEmployeeFilter(e.target.value); setTableLocationFilter(''); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">All employees</option>
                  {fieldUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </select>
                {(tableLocationFilter || tableEmployeeFilter) && (
                  <button
                    type="button"
                    onClick={() => { setTableLocationFilter(''); setTableEmployeeFilter(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Clear
                  </button>
                )}
                <span className="text-xs text-slate-400">{tableFilteredRequests.length} requests</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {tableFilteredRequests.slice(0, 50).map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{format(new Date(request.createdAt), 'd MMM yyyy')}</TableCell>
                      <TableCell>{request.storeName}</TableCell>
                      <TableCell>{request.category}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{formatCurrency(request.amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[request.status]}`}>
                          {request.status}
                        </span>
                      </TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
