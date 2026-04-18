'use client';

import { useState } from 'react';
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
import { formatCurrency } from '@/lib/utils';
import { STORE_DETAILS, type Period } from '@/lib/mockData';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#0284c7'];

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queried:  'bg-sky-50 text-sky-700',
};

const periodOptions: { label: string; value: Period }[] = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Quarter',    value: 'quarter' },
];

export default function StoreDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const slug    = Array.isArray(params.slug) ? params.slug[0] : (params.slug ?? '');
  const store   = STORE_DETAILS[slug];

  const [period, setPeriod] = useState<Period>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [statusFilter, setStatusFilter] = useState('');

  if (!store) {
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

  const data         = store[period];
  const budgetPct    = data.budget > 0 ? Math.min((data.totalSpent / data.budget) * 100, 100) : 0;
  const gaugeColor   = budgetPct >= 90 ? '#ef4444' : budgetPct >= 75 ? '#f59e0b' : '#10b981';
  const remaining    = Math.max(data.budget - data.totalSpent, 0);

  const filteredRequests = data.requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (dateRange?.from) {
      const d = new Date(r.createdAt);
      if (d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
    }
    return true;
  });

  const approvedTotal  = data.requests.filter((r) => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
  const pendingTotal   = data.requests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const topCategory    = [...data.byCategory].sort((a, b) => b.total - a.total)[0];

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
              Monthly budget: {formatCurrency(store.monthlyBudget)}
              {dateRange?.from && dateRange?.to && (
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
