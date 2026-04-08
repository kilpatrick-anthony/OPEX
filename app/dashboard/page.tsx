'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { formatCurrency } from '@/lib/utils';

const periodOptions = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Quarter', value: 'quarter' },
];

const COLORS = ['#0ea5e9', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'];

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (user?.role === 'director') {
      loadDashboard(period);
    }
  }, [user, period]);

  async function loadInitial() {
    const auth = await fetch('/api/auth/me');
    if (!auth.ok) {
      router.push('/login');
      return;
    }
    const userData = await auth.json();
    setUser(userData.user);
    if (userData.user.role !== 'director') {
      router.push('/requests');
      return;
    }
  }

  async function loadDashboard(selectedPeriod: string) {
    setLoading(true);
    const res = await fetch(`/api/dashboard?period=${selectedPeriod}`);
    const data = await res.json();
    setDashboard(data);
    setLoading(false);
  }

  const gaugeValue = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.totalBudget > 0 ? Math.min((dashboard.totalSpent / dashboard.totalBudget) * 100, 100) : 0;
  }, [dashboard]);

  function exportCsv() {
    if (!dashboard) return;
    const rows = [
      ['Store', 'Amount'],
      ...dashboard.byStore.map((item: any) => [item.name, item.total.toFixed(2)]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'opex-by-store.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase text-sky-600">Director dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">OPEX performance</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {periodOptions.map((option) => (
              <Button key={option.value} variant={option.value === period ? 'default' : 'secondary'} type="button" onClick={() => setPeriod(option.value)}>
                {option.label}
              </Button>
            ))}
            <Button variant="secondary" type="button" onClick={exportCsv} disabled={!dashboard}>
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm uppercase text-slate-500">Month-to-date spend</p>
                <p className="mt-3 text-4xl font-semibold text-slate-900">{dashboard ? formatCurrency(dashboard.totalSpent) : '—'}</p>
                <p className="mt-2 text-sm text-slate-500">Budget: {dashboard ? formatCurrency(dashboard.totalBudget) : '—'}</p>
                <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${gaugeValue}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{Math.round(gaugeValue)}% of budget used</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
                  <p className="text-sm text-slate-500">Remaining budget</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{dashboard ? formatCurrency(dashboard.remainingBudget) : '—'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
                  <p className="text-sm text-slate-500">Active stores</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{dashboard ? dashboard.byStore.length : '—'}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-6">
            <div className="h-80">
              <p className="mb-4 text-sm uppercase text-slate-500">Spend by store</p>
              {dashboard ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.byStore} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="total" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">Loading chart…</p>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase text-slate-500">Spend by category</p>
              </div>
            </div>
            <div className="h-80">
              {dashboard ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.byCategory} dataKey="total" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={4}>
                      {dashboard.byCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">Loading chart…</p>
              )}
            </div>
          </Card>

          <Card title="Top 5 expenses" description="Highest spend requests for the selected period." className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Requester</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {(dashboard?.topExpenses || []).map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{expense.storeName}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.requesterName}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
              {dashboard && dashboard.topExpenses.length === 0 && <p className="pt-6 text-sm text-slate-500">No approved spend in this period.</p>}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
