'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';

type DashboardPeriod = 'month' | 'last-month' | 'quarter';

type DashboardResponse = {
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

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Quarter', value: 'quarter' },
];

const COLORS = ['#0ea5e9', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const [dashboardRes, pendingRes] = await Promise.all([
        fetch(`/api/dashboard?period=${period}`, { cache: 'no-store' }),
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
      setPendingCount(Array.isArray((pendingPayload as any)?.requests) ? (pendingPayload as any).requests.length : 0);
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
    loadDashboard();
  }, [period, user, userLoading, router]);

  if (userLoading || (user && user.role === 'store_staff')) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading dashboard...</main>
      </div>
    );
  }

  const gaugeValue = useMemo(() => {
    if (!dashboard || dashboard.totalBudget <= 0) return 0;
    return Math.min((dashboard.totalSpent / dashboard.totalBudget) * 100, 100);
  }, [dashboard]);

  const gaugeColor = gaugeValue >= 90 ? '#ef4444' : gaugeValue >= 75 ? '#f59e0b' : '#0ea5e9';

  function exportCsv() {
    if (!dashboard) return;
    const rows = [['Store', 'Amount'], ...dashboard.byStore.map((item) => [item.name, item.total.toFixed(2)])];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `opex-by-store-${period}.csv`);
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
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </Button>
            ))}
            <Button variant="secondary" type="button" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total spend</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{formatCurrency(dashboard.totalSpent)}</p>
            <p className="mt-2 text-sm text-slate-500">of {formatCurrency(dashboard.totalBudget)} budget</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${gaugeValue}%`, backgroundColor: gaugeColor }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{Math.round(gaugeValue)}% utilized</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Remaining budget</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-600">{formatCurrency(dashboard.remainingBudget)}</p>
            <p className="mt-2 text-sm text-slate-500">Available to allocate</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Active stores</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{dashboard.byStore.length}</p>
            <p className="mt-2 text-sm text-slate-500">Stores with tracked budgets</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pending approvals</p>
            <p className="mt-3 text-4xl font-semibold text-amber-600">{pendingCount}</p>
            <p className="mt-2 text-sm text-slate-500">Awaiting director sign-off</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Spend by store</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.byStore} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
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
            <div>
              <p className="text-sm uppercase tracking-widest text-slate-500">Spend by category</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard.byCategory}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dashboard.byCategory.map((_, index) => (
                      <Cell key={`category-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
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
