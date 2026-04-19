'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { formatCurrency } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import { useRouter } from 'next/navigation';

type RequestRow = {
  id: number;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'queried';
  category: string;
  description: string;
  storeName: string;
  requesterName: string;
  createdAt: string;
};

type DashboardPayload = {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  byStore: Array<{ name: string; total: number }>;
};

type ForecastRow = {
  store: string;
  approved: number;
  pending: number;
  projected: number;
  budget: number;
  utilizationPct: number;
  variance: number;
  status: 'green' | 'amber' | 'red';
};

function statusFromPct(pct: number): ForecastRow['status'] {
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'amber';
  return 'green';
}

function statusColor(status: ForecastRow['status']) {
  if (status === 'red') return '#ef4444';
  if (status === 'amber') return '#f59e0b';
  return '#10b981';
}

function buildMonthlyTrend(approvedRequests: RequestRow[], pendingRequests: RequestRow[]) {
  const approvedByMonth = new Map<string, number>();
  const pendingByMonth = new Map<string, number>();

  for (const req of approvedRequests) {
    const key = format(new Date(req.createdAt), 'yyyy-MM');
    approvedByMonth.set(key, (approvedByMonth.get(key) || 0) + req.amount);
  }

  for (const req of pendingRequests) {
    const key = format(new Date(req.createdAt), 'yyyy-MM');
    pendingByMonth.set(key, (pendingByMonth.get(key) || 0) + req.amount);
  }

  const keys = Array.from(new Set([...approvedByMonth.keys(), ...pendingByMonth.keys()])).sort();

  return keys.slice(-12).map((month) => {
    const approved = approvedByMonth.get(month) || 0;
    const pending = pendingByMonth.get(month) || 0;
    return {
      month,
      approved,
      projected: approved + pending,
    };
  });
}

export default function ForecastPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canAccessForecast = user?.role === 'super_admin';

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!canAccessForecast) {
      router.replace('/dashboard');
    }
  }, [user, userLoading, canAccessForecast, router]);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [dashRes, reqRes] = await Promise.all([
        fetch('/api/dashboard?period=month', { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);

      const dashPayload = await dashRes.json();
      const reqPayload = await reqRes.json();

      if (!dashRes.ok) throw new Error(dashPayload.error || 'Failed to load monthly dashboard data');
      if (!reqRes.ok) throw new Error(reqPayload.error || 'Failed to load requests data');

      setDashboard(dashPayload as DashboardPayload);
      setRequests((reqPayload.requests || []) as RequestRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userLoading || !canAccessForecast) return;
    loadData();
  }, [userLoading, canAccessForecast]);

  if (userLoading || !canAccessForecast) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading forecast data...</main>
      </div>
    );
  }

  const approvedRequests = useMemo(() => requests.filter((r) => r.status === 'approved'), [requests]);
  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  const pendingByStore = useMemo(() => {
    const sums = new Map<string, number>();
    for (const req of pendingRequests) {
      sums.set(req.storeName, (sums.get(req.storeName) || 0) + req.amount);
    }
    return sums;
  }, [pendingRequests]);

  const forecastRows = useMemo<ForecastRow[]>(() => {
    if (!dashboard) return [];

    const totalApproved = dashboard.totalSpent;
    const totalPending = pendingRequests.reduce((sum, req) => sum + req.amount, 0);
    const budget = dashboard.totalBudget;

    return dashboard.byStore
      .map((store) => {
        const approved = store.total;
        const pending = pendingByStore.get(store.name) || 0;
        const projected = approved + pending;

        const budgetShare = totalApproved > 0 ? (approved / totalApproved) * budget : dashboard.byStore.length > 0 ? budget / dashboard.byStore.length : 0;
        const utilizationPct = budgetShare > 0 ? (projected / budgetShare) * 100 : 0;
        const variance = projected - budgetShare;

        return {
          store: store.name,
          approved,
          pending,
          projected,
          budget: budgetShare,
          utilizationPct,
          variance,
          status: statusFromPct(utilizationPct),
        };
      })
      .sort((a, b) => b.projected - a.projected);
  }, [dashboard, pendingByStore, pendingRequests]);

  const totals = useMemo(() => {
    const approved = forecastRows.reduce((sum, row) => sum + row.approved, 0);
    const pending = forecastRows.reduce((sum, row) => sum + row.pending, 0);
    const projected = approved + pending;
    const budget = forecastRows.reduce((sum, row) => sum + row.budget, 0);
    const utilizationPct = budget > 0 ? (projected / budget) * 100 : 0;

    return { approved, pending, projected, budget, utilizationPct };
  }, [forecastRows]);

  const monthlyTrend = useMemo(() => buildMonthlyTrend(approvedRequests, pendingRequests), [approvedRequests, pendingRequests]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading forecast data...</main>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10">
          <p className="text-sm text-rose-600">{error || 'Failed to load forecast data.'}</p>
          <Button className="mt-4" onClick={loadData}>Retry</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">Analytics</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Spend Forecasting</h1>
            <p className="mt-1 text-sm text-slate-500">Projection built from approved spend and pending requests.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Approved spend</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totals.approved)}</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Pending pipeline</p>
            <p className="mt-3 text-3xl font-semibold text-amber-600">{formatCurrency(totals.pending)}</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Projected month-end</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(totals.projected)}</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Projected utilisation</p>
            <p className={`mt-3 text-3xl font-semibold ${totals.utilizationPct >= 100 ? 'text-rose-600' : totals.utilizationPct >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totals.utilizationPct.toFixed(0)}%
            </p>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Approved vs projected trend (last 12 months)</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="approved" fill="#0ea5e9" name="Approved" radius={[8, 8, 0, 0]} />
                  <Line dataKey="projected" stroke="#f59e0b" strokeWidth={2} name="Projected" />
                  <ReferenceLine y={dashboard.totalBudget} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Budget', position: 'right' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Store-level month-end projection</p>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastRows} margin={{ bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="store" tick={{ fill: '#475569', fontSize: 11 }} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="projected" name="Projected" radius={[8, 8, 0, 0]}>
                    {forecastRows.map((row) => (
                      <Cell key={row.store} fill={statusColor(row.status)} />
                    ))}
                  </Bar>
                  <Bar dataKey="budget" name="Budget" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {forecastRows.map((row) => (
            <Card key={row.store} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{row.store}</p>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ color: statusColor(row.status), backgroundColor: `${statusColor(row.status)}1A` }}
                >
                  {row.status === 'red' ? 'Over' : row.status === 'amber' ? 'Watch' : 'On Track'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Projected</p>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(row.projected)}</p>
              <p className="mt-1 text-xs text-slate-500">Budget {formatCurrency(row.budget)}</p>
              <p className={`mt-1 text-xs font-medium ${row.variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
              </p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
