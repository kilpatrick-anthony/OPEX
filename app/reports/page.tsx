'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { formatCurrency } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { label: 'Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'Quarter', value: 'quarter' },
  { label: 'Year', value: 'year' },
] as const;

type Period = (typeof PERIOD_OPTIONS)[number]['value'];

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

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [dashRes, reqRes] = await Promise.all([
        fetch(`/api/dashboard?period=${period}`, { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);

      const dashPayload = await dashRes.json();
      const reqPayload = await reqRes.json();

      if (!dashRes.ok) throw new Error(dashPayload.error || 'Failed to load dashboard report data');
      if (!reqRes.ok) throw new Error(reqPayload.error || 'Failed to load requests report data');

      setDashboard(dashPayload as DashboardPayload);
      setRequests((reqPayload.requests || []) as RequestRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [period]);

  const approved = useMemo(() => requests.filter((r) => r.status === 'approved'), [requests]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<RequestRow['status'], number> = {
      approved: 0,
      pending: 0,
      rejected: 0,
      queried: 0,
    };

    for (const req of requests) counts[req.status] += 1;

    return (Object.keys(counts) as RequestRow['status'][])
      .filter((status) => counts[status] > 0)
      .map((status) => ({ name: status, value: counts[status], color: STATUS_COLORS[status] }));
  }, [requests]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();

    for (const req of approved) {
      const key = format(new Date(req.createdAt), 'yyyy-MM');
      byMonth.set(key, (byMonth.get(key) || 0) + req.amount);
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, total]) => ({ month: key, total }));
  }, [approved]);

  function exportCsv() {
    const rows: string[][] = [
      ['ID', 'Date', 'Store', 'Category', 'Amount', 'Status', 'Requester', 'Description'],
      ...requests.map((r) => [
        String(r.id),
        r.createdAt,
        r.storeName,
        r.category,
        r.amount.toFixed(2),
        r.status,
        r.requesterName,
        r.description,
      ]),
    ];

    downloadCsv(rows, `opex-report-${period}.csv`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10 text-sm text-slate-500">Loading report data...</main>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container py-10">
          <p className="text-sm text-rose-600">{error || 'Failed to load reports.'}</p>
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
            <p className="text-sm uppercase tracking-widest text-sky-600">OPEX Reporting</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Network Reports</h1>
            <p className="mt-1 text-sm text-slate-500">Live reporting from submitted requests and approved spend.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={opt.value === period ? 'default' : 'secondary'}
                type="button"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>

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

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Spend by store</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.byStore}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-sm uppercase tracking-widest text-slate-500">Request status distribution</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} label>
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => String(value)} />
                </PieChart>
              </ResponsiveContainer>
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
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} name="Approved Spend" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card title="Recent requests" description="Latest submitted requests across the network." className="space-y-4">
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
                  {requests.slice(0, 20).map((request) => (
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
