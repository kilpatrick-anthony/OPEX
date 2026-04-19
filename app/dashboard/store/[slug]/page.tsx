'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { formatCurrency, readJsonSafely } from '@/lib/utils';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#0284c7'];

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queried:  'bg-sky-50 text-sky-700',
};

type Period = 'month' | 'last-month' | 'quarter';

const periodOptions: { label: string; value: Period }[] = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Quarter',    value: 'quarter' },
];

type StoreRecord = { id: number; name: string; budget: number };
type RequestRow = {
  id: number; amount: number; status: string; category: string;
  description: string; storeName: string; requesterName: string;
  requesterRole: string; createdAt: string;
};

function inPeriod(date: Date, period: Period) {
  const now = new Date();
  if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === 'last-month') { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return date.getFullYear() === lm.getFullYear() && date.getMonth() === lm.getMonth(); }
  const qStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return date >= qStart;
}

function build6MonthTrend(requests: RequestRow[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString('en-IE', { month: 'short', year: '2-digit' });
    const total = requests.filter((r) => { const cd = new Date(r.createdAt); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth(); }).reduce((s, r) => s + r.amount, 0);
    return { month: label, total };
  });
}

function unslugify(slug: string) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function StoreDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const slug    = Array.isArray(params.slug) ? params.slug[0] : (params.slug ?? '');

  const [store, setStore] = useState<StoreRecord | null>(null);
  const [allRequests, setAllRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [period, setPeriod] = useState<Period>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [storesRes, reqRes] = await Promise.all([
        fetch('/api/stores', { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);
      const storesData = await readJsonSafely(storesRes) as StoreRecord[] | null;
      const reqData = await readJsonSafely(reqRes) as { requests?: RequestRow[] } | null;
      const slugName = unslugify(slug).toLowerCase();
      const found = Array.isArray(storesData) ? storesData.find((s) => s.name.toLowerCase() === slugName) : undefined;
      if (!found) { setNotFound(true); setLoading(false); return; }
      setStore(found);
      const storeReqs = (reqData?.requests ?? []).filter((r) => r.storeName.toLowerCase() === found.name.toLowerCase());
      setAllRequests(storeReqs);
      setLoading(false);
    }
    load();
  }, [slug]);

  const periodRequests = useMemo(() => {
    if (dateRange?.from) {
      return allRequests.filter((r) => {
        const d = new Date(r.createdAt);
        if (d < dateRange.from!) return false;
        if (dateRange.to && d > dateRange.to) return false;
        return true;
      });
    }
    return allRequests.filter((r) => inPeriod(new Date(r.createdAt), period));
  }, [allRequests, period, dateRange]);

  const periodMultiplier = period === 'quarter' ? 3 : 1;
  const monthlyBudget = store?.budget ?? 0;
  const budgetForPeriod = monthlyBudget * periodMultiplier;
  const totalSpent = periodRequests.reduce((s, r) => s + r.amount, 0);
  const approvedTotal = periodRequests.filter((r) => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
  const pendingTotal  = periodRequests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(budgetForPeriod - approvedTotal, 0);
  const budgetPct = budgetForPeriod > 0 ? Math.min((approvedTotal / budgetForPeriod) * 100, 100) : 0;
  const gaugeColor = budgetPct >= 90 ? '#ef4444' : budgetPct >= 75 ? '#f59e0b' : '#10b981';

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of periodRequests) map.set(r.category, (map.get(r.category) ?? 0) + r.amount);
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }, [periodRequests]);

  const topCategory = byCategory[0];
  const trend = useMemo(() => build6MonthTrend(allRequests), [allRequests]);

  const filteredRequests = useMemo(() => {
    return periodRequests.filter((r) => !statusFilter || r.status === statusFilter);
  }, [periodRequests, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-20 text-center"><p className="text-slate-400">Loading…</p></main>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-20 text-center">
          <p className="text-slate-500">Store not found.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sky-600 underline">Back to dashboard</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-sky-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="font-medium text-slate-800">{store.name}</span>
        </div>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-700">Store</span>
              <span className="text-xs text-slate-400">OAKBERRY Ireland</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{store.name}</h1>
            <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-2">
              Monthly budget: {formatCurrency(monthlyBudget)}
              {dateRange?.from && dateRange?.to && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {format(dateRange.from, 'd MMM')} – {format(dateRange.to, 'd MMM yyyy')}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((opt) => (
              <Button key={opt.value} variant={!dateRange && opt.value === period ? 'default' : 'secondary'}
                type="button" onClick={() => { setPeriod(opt.value); setDateRange(undefined); }}>
                {opt.label}
              </Button>
            ))}
            <DateRangePicker range={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(totalSpent)}</p>
            <p className="mt-2 text-sm text-slate-500">of {formatCurrency(budgetForPeriod)} budget</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, backgroundColor: gaugeColor }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{Math.round(budgetPct)}% utilised</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Remaining budget</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-600">{formatCurrency(remaining)}</p>
            <p className="mt-2 text-sm text-slate-500">Available to allocate</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Approved spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(approvedTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {periodRequests.filter((r) => r.status === 'approved').length} approved request{periodRequests.filter((r) => r.status === 'approved').length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pending value</p>
            <p className="mt-3 text-4xl font-semibold text-amber-600">{formatCurrency(pendingTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">Awaiting approval</p>
          </div>
        </div>

        {/* ── Trend + Category breakdown ───────────────────────────────────── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">

          {/* 6-month trend */}
          <Card className="gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">6-month spend trend</p>
              <p className="mt-1 text-xs text-slate-400">Monthly OPEX versus {formatCurrency(monthlyBudget)} budget</p>
            </div>
            <div className="flex-1 min-h-[14rem]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2.5}
                    dot={{ fill: '#0ea5e9', r: 4 }} activeDot={{ r: 6 }} name="Spend" />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm">
              <span className="h-2 w-8 rounded-full bg-slate-300" />
              <span className="text-slate-500">Monthly budget: {formatCurrency(monthlyBudget)}</span>
            </div>
          </Card>

          {/* Category breakdown */}
          <Card className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Spend by category</p>
              <p className="mt-1 text-xs text-slate-400">Breakdown for {period === 'month' ? 'this month' : period === 'last-month' ? 'last month' : 'this quarter'}</p>
            </div>
            {byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No spend recorded for this period.</p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byCategory} dataKey="total" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={4}>
                        {byCategory.map((_, i) => <Cell key={`cat-${i}`} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {byCategory.map((cat, i) => (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700">{cat.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900">{formatCurrency(cat.total)}</span>
                        <span className="ml-2 text-xs text-slate-400">
                          {totalSpent > 0 ? Math.round((cat.total / totalSpent) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {topCategory && (
                    <div className="mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
                      Top category: <strong>{topCategory.category}</strong> at {formatCurrency(topCategory.total)}
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ── Category bar chart ───────────────────────────────────────────── */}
        {byCategory.length > 0 && (
          <div className="mt-6">
            <Card className="space-y-4">
              <p className="text-sm uppercase tracking-widest text-slate-500">Category comparison</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                      {byCategory.map((_, i) => <Cell key={`bar-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* ── Requests table ───────────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-500">Request history</p>
                <p className="mt-1 text-xs text-slate-400">{periodRequests.length} request{periodRequests.length !== 1 ? 's' : ''} for this period</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['', 'pending', 'approved', 'queried', 'rejected'].map((s) => (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {filteredRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No requests match the selected filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Requester</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{req.requesterName}</p>
                            <p className="text-xs text-slate-400">{req.requesterRole}</p>
                          </div>
                        </TableCell>
                        <TableCell><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{req.category}</span></TableCell>
                        <TableCell className="max-w-xs text-sm text-slate-600">{req.description}</TableCell>
                        <TableCell className="font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(req.amount)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[req.status]}`}>{req.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <div className="mt-8">
          <Button variant="secondary" type="button" onClick={() => router.push('/dashboard')}>← Back to Dashboard</Button>
        </div>

      </main>
    </div>
  );
}
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {format(dateRange.from, 'd MMM')} – {format(dateRange.to, 'd MMM yyyy')}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periodOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={!dateRange && opt.value === period ? 'default' : 'secondary'}
                type="button"
                onClick={() => { setPeriod(opt.value); setDateRange(undefined); }}
              >
                {opt.label}
              </Button>
            ))}
            <DateRangePicker range={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(data.totalSpent)}</p>
            <p className="mt-2 text-sm text-slate-500">of {formatCurrency(data.budget)} budget</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${budgetPct}%`, backgroundColor: gaugeColor }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{Math.round(budgetPct)}% utilised</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Remaining budget</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-600">{formatCurrency(remaining)}</p>
            <p className="mt-2 text-sm text-slate-500">Available to allocate</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Approved spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(approvedTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {data.requests.filter((r) => r.status === 'approved').length} approved request{data.requests.filter((r) => r.status === 'approved').length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pending value</p>
            <p className="mt-3 text-4xl font-semibold text-amber-600">{formatCurrency(pendingTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">Awaiting approval</p>
          </div>
        </div>

        {/* ── Trend + Category breakdown ───────────────────────────────────── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">

          {/* 6-month trend */}
          <Card className="gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">6-month spend trend</p>
              <p className="mt-1 text-xs text-slate-400">Monthly OPEX versus {formatCurrency(store.monthlyBudget)} budget</p>
            </div>
            <div className="flex-1 min-h-[14rem]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={store.trend} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={{ fill: '#0ea5e9', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Spend"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Budget reference annotation */}
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm">
              <span className="h-2 w-8 rounded-full bg-slate-300" />
              <span className="text-slate-500">Monthly budget: {formatCurrency(store.monthlyBudget)}</span>
            </div>
          </Card>

          {/* Category breakdown */}
          <Card className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Spend by category</p>
              <p className="mt-1 text-xs text-slate-400">Breakdown for {period === 'month' ? 'this month' : period === 'last-month' ? 'last month' : 'this quarter'}</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byCategory}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                  >
                    {data.byCategory.map((_: any, i: number) => (
                      <Cell key={`cat-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {data.byCategory.map((cat, i) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-700">{cat.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900">{formatCurrency(cat.total)}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {data.totalSpent > 0 ? Math.round((cat.total / data.totalSpent) * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
              {topCategory && (
                <div className="mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  Top category: <strong>{topCategory.category}</strong> at {formatCurrency(topCategory.total)}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Category bar chart ───────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Category comparison</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {data.byCategory.map((_: any, i: number) => (
                      <Cell key={`bar-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Requests table ───────────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-500">Request history</p>
                <p className="mt-1 text-xs text-slate-400">
                  {data.requests.length} request{data.requests.length !== 1 ? 's' : ''} for this period
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['', 'pending', 'approved', 'queried', 'rejected'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No requests match the selected filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Requester</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">{req.requesterName}</p>
                            <p className="text-xs text-slate-400">{req.requesterRole}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{req.category}</span>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-slate-600">{req.description}</TableCell>
                        <TableCell className="font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(req.amount)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[req.status]}`}>
                            {req.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </div>

        {/* ── Back button ─────────────────────────────────────────────────── */}
        <div className="mt-8">
          <Button variant="secondary" type="button" onClick={() => router.push('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

      </main>
    </div>
  );
}
