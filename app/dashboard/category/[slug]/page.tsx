'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, LineChart, Line, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { formatCurrency } from '@/lib/utils';
import { getCategoryDetail, type Period } from '@/lib/mockData';

const STORE_COLOR  = '#0ea5e9';
const EMP_COLOR    = '#10b981';
const LINE_COLOR   = '#f59e0b';

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

const CATEGORY_ICONS: Record<string, string> = {
  supplies:               '📦',
  marketing:              '📣',
  maintenance:            '🔧',
  travel:                 '✈️',
  utilities:              '⚡',
  equipment:              '🖥️',
  'lunch-and-dinner':     '🍽️',
  subscriptions:          '🔄',
  'software-licenses':    '💻',
  repairs:                '🛠️',
  'courier-and-delivery': '📦',
  events:                 '🎉',
  training:               '🎓',
  'professional-services':'🤝',
};

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug   = Array.isArray(params.slug) ? params.slug[0] : (params.slug ?? '');

  const [period, setPeriod] = useState<Period>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [entityFilter, setEntityFilter] = useState<'all' | 'store' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState('');

  const category = getCategoryDetail(slug);

  if (!category) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-20 text-center">
          <p className="text-slate-500">Category not found.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sky-600 underline">Back to dashboard</Link>
        </main>
      </div>
    );
  }

  const data = category[period];

  const filteredEntities = data.byEntity.filter(
    (e) => entityFilter === 'all' || e.type === entityFilter,
  );

  const filteredRequests = data.requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (dateRange?.from) {
      const d = new Date(r.createdAt);
      if (d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
    }
    return true;
  });

  const storeTotal    = data.byEntity.filter((e) => e.type === 'store').reduce((s, e) => s + e.total, 0);
  const empTotal      = data.byEntity.filter((e) => e.type === 'employee').reduce((s, e) => s + e.total, 0);
  const topEntity     = data.byEntity[0];

  const icon = CATEGORY_ICONS[slug] ?? '💰';

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">

        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/dashboard" className="hover:text-sky-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-slate-500">Category</span>
          <span>›</span>
          <span className="font-medium text-slate-800">{category.name}</span>
        </div>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{icon}</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">Category</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{category.name}</h1>
            <p className="mt-1 text-sm text-slate-500 flex flex-wrap items-center gap-2">
              Spend across all stores and field team members
              {dateRange?.from && dateRange?.to && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
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
            <p className="text-xs uppercase tracking-widest text-slate-500">Total {category.name} spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(data.total)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {data.total > 0 && data.budget > 0 ? `${Math.round((data.total / data.budget) * 100)}% of total OPEX budget` : 'No spend recorded'}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Stores spending</p>
            <p className="mt-3 text-4xl font-semibold text-sky-600">{formatCurrency(storeTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {data.byEntity.filter((e) => e.type === 'store').length} stores
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Field team spending</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-600">{formatCurrency(empTotal)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {data.byEntity.filter((e) => e.type === 'employee').length} team members
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Top spender</p>
            <p className="mt-3 text-xl font-semibold text-slate-900 leading-tight">{topEntity?.name ?? '—'}</p>
            <p className="mt-2 text-sm font-semibold text-amber-600">{topEntity ? formatCurrency(topEntity.total) : '—'}</p>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${topEntity?.type === 'employee' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
              {topEntity?.type === 'employee' ? 'Field team' : 'Store'}
            </span>
          </div>
        </div>

        {/* ── Trend ────────────────────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">6-month spend trend · {category.name}</p>
              <p className="mt-1 text-xs text-slate-400">Total monthly {category.name.toLowerCase()} spend across all entities</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={category.trend} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={LINE_COLOR}
                    strokeWidth={2.5}
                    dot={{ fill: LINE_COLOR, r: 4 }}
                    activeDot={{ r: 6 }}
                    name={category.name}
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── Breakdown by entity ──────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-500">Spend breakdown by entity</p>
                <p className="mt-1 text-xs text-slate-400">
                  Who is spending on {category.name.toLowerCase()} — stores vs field team
                </p>
              </div>
              <div className="flex gap-2">
                {(['all', 'store', 'employee'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEntityFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      entityFilter === f
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'store' ? 'Stores' : 'Field team'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredEntities}
                  margin={{ top: 0, right: 10, left: 0, bottom: 60 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    width={140}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v}
                  />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                    {filteredEntities.map((e, i) => (
                      <Cell key={`entity-${i}`} fill={e.type === 'employee' ? EMP_COLOR : STORE_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STORE_COLOR }} />
                Store
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMP_COLOR }} />
                Field team
              </div>
            </div>
          </Card>
        </div>

        {/* ── Top spenders table ───────────────────────────────────────────── */}
        <div className="mt-6">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Entity spend summary</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Share</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {filteredEntities.map((entity, i) => (
                    <TableRow key={entity.name}>
                      <TableCell className="text-slate-400 font-medium">{i + 1}</TableCell>
                      <TableCell className="font-medium text-slate-800">{entity.name}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          entity.type === 'employee'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-sky-50 text-sky-700'
                        }`}>
                          {entity.type === 'employee' ? 'Field team' : 'Store'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">{formatCurrency(entity.total)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${data.total > 0 ? Math.round((entity.total / data.total) * 100) : 0}%`,
                                backgroundColor: entity.type === 'employee' ? EMP_COLOR : STORE_COLOR,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {data.total > 0 ? Math.round((entity.total / data.total) * 100) : 0}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        {/* ── Requests for this category ───────────────────────────────────── */}
        {filteredRequests.length > 0 && (
          <div className="mt-6">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-slate-500">Top requests · {category.name}</p>
                  <p className="mt-1 text-xs text-slate-400">Up to 10 highest-value requests across all entities</p>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Requester</th>
                      <th className="px-4 py-3 text-left">Role</th>
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
                        <TableCell className="font-medium text-slate-800">{req.requesterName}</TableCell>
                        <TableCell className="text-sm text-slate-500">{req.requesterRole}</TableCell>
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
            </Card>
          </div>
        )}

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
