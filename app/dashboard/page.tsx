'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { slugify } from '@/lib/mockData';
import { useCurrentUser } from '@/lib/userContext';

type DashboardPeriod = 'month' | 'week' | 'custom';

function StoreNameTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const displayValue = payload.value === 'Dun Laoghaire' ? 'Dun\nLaoghaire' : payload.value;
  const words = displayValue.includes('\n') ? displayValue.split('\n') : displayValue.split(' ');
  const lines = words.reduce<string[]>((result, word) => {
    const current = result[result.length - 1];
    if (!current || `${current} ${word}`.length > 14) result.push(word);
    else result[result.length - 1] = `${current} ${word}`;
    return result;
  }, []);

  return (
    <text x={x} y={y} fill="#475569" fontSize={11} textAnchor="middle">
      {lines.slice(0, 3).map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 14 : 13}>{line}</tspan>
      ))}
    </text>
  );
}

type DashboardResponse = {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  byStore: Array<{ name: string; budget: number; total: number; pending: number }>;
  byCategory: Array<{ category: string; total: number }>;
  topExpenses: Array<{
    id: number;
    amount: number;
    storeName: string;
    category: string;
    requesterName: string;
  }>;
};

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'This month', value: 'month' },
  { label: 'This week', value: 'week' },
  { label: 'Date range', value: 'custom' },
];

const COLORS = ['#0ea5e9', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [includeWarehouse, setIncludeWarehouse] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Array<{ amount: number; storeName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      let dashUrl = `/api/dashboard?period=${period}`;
      if (period === 'custom' && customRange?.from && customRange?.to) {
        dashUrl += `&from=${customRange.from.toISOString().split('T')[0]}&to=${customRange.to.toISOString().split('T')[0]}`;
      }

      const [dashboardRes, pendingRes] = await Promise.all([
        fetch(dashUrl, { cache: 'no-store' }),
        fetch('/api/requests?status=pending', { cache: 'no-store' }),
      ]);

      const dashboardPayload = await readJsonSafely(dashboardRes);
      const pendingPayload = await readJsonSafely(pendingRes);

      if (!dashboardRes.ok) {
        throw new Error(getApiErrorMessage(dashboardRes, dashboardPayload, 'Failed to load dashboard'));
      }
      if (!pendingRes.ok) {
        throw new Error(getApiErrorMessage(pendingRes, pendingPayload, 'Failed to load pending count'));
      }

      if (!dashboardPayload || typeof dashboardPayload !== 'object') {
        throw new Error('Dashboard returned an empty response. Please try again.');
      }

      setDashboard(dashboardPayload as DashboardResponse);
      const loadedPendingRequests: Array<{ amount: number; storeName: string }> = Array.isArray((pendingPayload as any)?.requests)
        ? (pendingPayload as any).requests
        : [];
      setPendingRequests(loadedPendingRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'store_staff') {
      router.replace('/requests');
      return;
    }
    if (period === 'custom' && (!customRange?.from || !customRange?.to)) return;
    loadDashboard();
  }, [period, customRange, user, userLoading, router]);

  const spendByStore = dashboard?.byStore.filter((store) => (
    includeWarehouse || store.name.trim().toLowerCase() !== 'warehouse'
  )) ?? [];
  const chartSpendByStore = spendByStore.filter((store) => (
    store.name.replace(/\s+/g, '').toLowerCase() !== 'kildarevillage'
  ));
  const totalBudget = spendByStore.reduce((sum, store) => sum + store.budget, 0);
  const totalSpent = spendByStore.reduce((sum, store) => sum + store.total, 0);
  const visiblePendingRequests = pendingRequests.filter((request) => (
    includeWarehouse || request.storeName.trim().toLowerCase() !== 'warehouse'
  ));
  const pendingCount = pendingRequests.length;
  const pendingSpendCount = visiblePendingRequests.length;
  const pendingPipeline = visiblePendingRequests.reduce((sum, request) => sum + request.amount, 0);
  const gaugeValue = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const gaugeColor = gaugeValue >= 90 ? '#ef4444' : gaugeValue >= 75 ? '#f59e0b' : '#0ea5e9';
  const canOpenApprovals = user?.role === 'director' || user?.role === 'super_admin';

  if (userLoading || (user && user.role === 'store_staff')) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading dashboard...</main>
      </div>
    );
  }

  function exportCsv() {
    if (!dashboard) return;
    const rows = [['Store', 'Approved Amount', 'Awaiting Approval'], ...spendByStore.map((item) => [
      item.name,
      item.total.toFixed(2),
      item.pending.toFixed(2),
    ])];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodLabel = period === 'custom' && customRange?.from && customRange?.to
      ? `${customRange.from.toISOString().split('T')[0]}-to-${customRange.to.toISOString().split('T')[0]}`
      : period;
    link.setAttribute('download', `opex-by-store-${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading dashboard…</main>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10">
          <p className="text-sm text-rose-600">{error || 'Failed to load dashboard data.'}</p>
          <Button className="mt-4" onClick={loadDashboard}>Retry</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">OPEX Performance</h1>
            <p className="mt-1 text-sm text-slate-500">Live data from approved requests and budgets.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={option.value === period ? 'default' : 'secondary'}
                type="button"
                onClick={() => { setPeriod(option.value); if (option.value !== 'custom') setCustomRange(undefined); }}
              >
                {option.label}
              </Button>
            ))}
            {period === 'custom' && (
              <DateRangePicker
                range={customRange}
                onChange={(r) => setCustomRange(r)}
              />
            )}
            <Button variant="secondary" type="button" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total spend</p>
            <p className="mt-3 text-2xl sm:text-4xl font-semibold text-slate-900">{formatCurrency(totalSpent)}</p>
            <p className="mt-2 text-sm text-slate-500">of {formatCurrency(totalBudget)} budget</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${gaugeValue}%`, backgroundColor: gaugeColor }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{Math.round(gaugeValue)}% utilised</p>
          </div>

          {canOpenApprovals ? (
            <Link
              href="/approval"
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
            >
              <p className="text-xs uppercase tracking-widest text-slate-500">Pending approvals</p>
              <p className="mt-3 text-2xl sm:text-4xl font-semibold text-amber-600">{pendingCount}</p>
              <p className="mt-2 text-sm text-slate-500">Awaiting director sign-off</p>
            </Link>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
              <p className="text-xs uppercase tracking-widest text-slate-500">Pending approvals</p>
              <p className="mt-3 text-2xl sm:text-4xl font-semibold text-amber-600">{pendingCount}</p>
              <p className="mt-2 text-sm text-slate-500">Awaiting director sign-off</p>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pending pipeline</p>
            <p className="mt-3 text-2xl sm:text-4xl font-semibold text-amber-600">{formatCurrency(pendingPipeline)}</p>
            <p className="mt-2 text-sm text-slate-500">{pendingSpendCount} request{pendingSpendCount !== 1 ? 's' : ''} awaiting approval</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Projected period end</p>
            <p className="mt-3 text-2xl sm:text-4xl font-semibold text-slate-900">{formatCurrency(totalSpent + pendingPipeline)}</p>
            <p className="mt-2 text-sm text-slate-500">
              {period === 'month' ? 'If all pending approved this month' : period === 'week' ? 'If all pending approved this week' : 'If all pending approved in this date range'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-500">Spend by store</p>
                <p className="mt-1 text-xs text-slate-400 sm:hidden">Swipe sideways to see all stores</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Include warehouse</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeWarehouse}
                  aria-label="Include warehouse in spend by store"
                  onClick={() => setIncludeWarehouse((included) => !included)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${includeWarehouse ? 'bg-sky-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${includeWarehouse ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <div className="-mx-2 overflow-x-auto px-2 pb-2 sm:mx-0 sm:px-0">
              <div className="h-[350px] w-[960px] sm:w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartSpendByStore} margin={{ top: 0, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" interval={0} height={84} tickLine={false} tick={<StoreNameTick x={0} y={0} payload={{ value: '' }} />} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'total' ? 'Approved' : 'Awaiting approval',
                      ]}
                    />
                    <Legend formatter={(value) => value === 'total' ? 'Approved' : 'Awaiting approval'} />
                    <Bar dataKey="total" stackId="spend" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" stackId="spend" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="mt-6 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Spend by category</p>
            </div>
            <div className="space-y-2">
              {dashboard.byCategory.map((item, index) => {
                const max = Math.max(...dashboard.byCategory.map((c) => c.total));
                const pct = max > 0 ? (item.total / max) * 100 : 0;
                return (
                  <Link
                    key={item.category}
                    href={`/dashboard/category/${slugify(item.category)}`}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className="w-36 shrink-0 text-xs font-medium text-slate-700 group-hover:text-sky-600 truncate">{item.category}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs font-semibold text-slate-900">{formatCurrency(item.total)}</span>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card title="Top 5 expenses" description="Highest approved spend requests for the selected period." className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {dashboard.topExpenses.map((expense, index) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-slate-400 font-medium">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{expense.storeName}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{expense.category}</span>
                      </TableCell>
                      <TableCell>{expense.requesterName}</TableCell>
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
