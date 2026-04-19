'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Card }   from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { formatCurrency, readJsonSafely } from '@/lib/utils';

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#0284c7'];

type Period = 'month' | 'last-month' | 'quarter';

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'Quarter',    value: 'quarter' },
];

type StoreRow   = { id: number; name: string; budget: number };
type UserRow    = { id: number; name: string; title: string | null; budget: number };
type RequestRow = {
  id: number; amount: number; status: string; category: string;
  description: string; storeName: string; requesterName: string;
  requesterRole: string; createdAt: string; userId?: number;
};

type EntityKey = string; // "store:1" | "employee:3"

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

function getBudgetPct(spent: number, budget: number) {
  return budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
}

function healthColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f59e0b';
  return '#10b981';
}

type CompareEntity = {
  key:         EntityKey;
  name:        string;
  type:        'store' | 'employee';
  totalSpent:  number;
  budget:      number;
  pct:         number;
  byCategory:  { category: string; total: number }[];
  trend:       { month: string; total: number }[];
  requests:    RequestRow[];
  color:       string;
  slug:        string;
};

export default function ComparePage() {
  const [period,      setPeriod]      = useState<Period>('month');
  const [selected,    setSelected]    = useState<EntityKey[]>([]);
  const [stores,      setStores]      = useState<StoreRow[]>([]);
  const [fieldUsers,  setFieldUsers]  = useState<UserRow[]>([]);
  const [allRequests, setAllRequests] = useState<RequestRow[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [storesRes, usersRes, reqRes] = await Promise.all([
        fetch('/api/stores', { cache: 'no-store' }),
        fetch('/api/users',  { cache: 'no-store' }),
        fetch('/api/requests', { cache: 'no-store' }),
      ]);
      const storesData  = await readJsonSafely(storesRes) as StoreRow[] | null;
      const usersData   = await readJsonSafely(usersRes)  as UserRow[]  | null;
      const reqData     = await readJsonSafely(reqRes)    as { requests?: RequestRow[] } | null;
      const loadedStores = Array.isArray(storesData) ? storesData : [];
      const loadedUsers  = Array.isArray(usersData)  ? usersData  : [];
      setStores(loadedStores);
      setFieldUsers(loadedUsers);
      setAllRequests(reqData?.requests ?? []);
      // Default select first two stores if available
      const defaultKeys = loadedStores.slice(0, 2).map((s) => `store:${s.id}`);
      setSelected(defaultKeys);
      setLoading(false);
    }
    load();
  }, []);

  // ── Derived data per selected entity ──────────────────────────────────────

  const entities = useMemo<CompareEntity[]>(() => {
    return selected.flatMap((key, idx) => {
      const [type, idStr] = key.split(':');
      const id = Number(idStr);
      let name = '';
      let budget = 0;
      let entityRequests: RequestRow[] = [];
      let slug = '';
      if (type === 'store') {
        const store = stores.find((s) => s.id === id);
        if (!store) return [];
        name   = store.name;
        budget = store.budget;
        slug   = store.name.toLowerCase().replace(/\s+/g, '-');
        entityRequests = allRequests.filter((r) => r.storeName.toLowerCase() === store.name.toLowerCase());
      } else {
        const user = fieldUsers.find((u) => u.id === id);
        if (!user) return [];
        name   = user.name;
        budget = user.budget;
        slug   = user.name.toLowerCase().replace(/\s+/g, '-');
        entityRequests = allRequests.filter((r) => r.userId === id || r.requesterName.toLowerCase() === user.name.toLowerCase());
      }

      const periodReqs = entityRequests.filter((r) => inPeriod(new Date(r.createdAt), period));
      const totalSpent = periodReqs.reduce((s, r) => s + r.amount, 0);
      const pct = getBudgetPct(totalSpent, budget);

      const catMap = new Map<string, number>();
      for (const r of periodReqs) catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
      const byCategory = [...catMap.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

      const trend = build6MonthTrend(entityRequests);

      return [{ key, name, type: type as 'store' | 'employee', totalSpent, budget, pct, byCategory, trend, requests: periodReqs, color: PALETTE[idx % PALETTE.length], slug }];
    });
  }, [selected, period, stores, fieldUsers, allRequests]);

  // ── Category comparison ────────────────────────────────────────────────────

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of entities) for (const c of e.byCategory) cats.add(c.category);
    return [...cats].sort();
  }, [entities]);

  const categoryBarData = useMemo(() => {
    return allCategories.map((cat) => {
      const row: Record<string, any> = { category: cat };
      for (const e of entities) {
        const match = e.byCategory.find((c) => c.category === cat);
        row[e.name] = match?.total ?? 0;
      }
      return row;
    });
  }, [allCategories, entities]);

  const radarData = useMemo(() => {
    return allCategories.map((cat) => {
      const row: Record<string, any> = { category: cat };
      for (const e of entities) {
        const match = e.byCategory.find((c) => c.category === cat);
        row[e.name] = match?.total ?? 0;
      }
      return row;
    });
  }, [allCategories, entities]);

  // ── Trend comparison ───────────────────────────────────────────────────────

  const trendMonths = useMemo(() => {
    if (entities.length === 0) return [];
    return entities[0].trend.map((t) => t.month);
  }, [entities]);

  const trendData = useMemo(() => {
    return trendMonths.map((month) => {
      const row: Record<string, any> = { month };
      for (const e of entities) {
        const point = e.trend.find((t) => t.month === month);
        row[e.name] = point?.total ?? 0;
      }
      return row;
    });
  }, [trendMonths, entities]);

  // ── Status summary ─────────────────────────────────────────────────────────

  const statusData = useMemo(() => {
    return entities.map((e) => {
      const approved = e.requests.filter((r) => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
      const pending  = e.requests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
      const rejected = e.requests.filter((r) => r.status === 'rejected').reduce((s, r) => s + r.amount, 0);
      const queried  = e.requests.filter((r) => r.status === 'queried').reduce((s, r) => s + r.amount, 0);
      return { name: e.name, approved, pending, rejected, queried };
    });
  }, [entities]);

  // ── Toggle entity ──────────────────────────────────────────────────────────

  function toggleEntity(key: EntityKey) {
    setSelected((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 4) return prev;
      return [...prev, key];
    });
  }
      const row: Record<string, any> = { category: cat };
      for (const e of entities) {
        const match = e.byCategory.find((c) => c.category === cat);
        row[e.name] = match?.total ?? 0;
      }
      return row;
    });
  }, [allCategories, entities]);

  const radarData = useMemo(() => {
    return allCategories.map((cat) => {
      const row: Record<string, any> = { category: cat };
      for (const e of entities) {
        const match = e.byCategory.find((c) => c.category === cat);
        row[e.name] = match?.total ?? 0;
      }
      return row;
    });
  }, [allCategories, entities]);

  // ── Trend comparison ───────────────────────────────────────────────────────

  const trendMonths = useMemo(() => {
    if (entities.length === 0) return [];
    return entities[0].trend.map((t) => t.month);
  }, [entities]);

  const trendData = useMemo(() => {
    return trendMonths.map((month) => {
      const row: Record<string, any> = { month };
      for (const e of entities) {
        const point = e.trend.find((t) => t.month === month);
        row[e.name] = point?.total ?? 0;
      }
      return row;
    });
  }, [trendMonths, entities]);

  // ── Status summary ─────────────────────────────────────────────────────────

  const statusData = useMemo(() => {
    return entities.map((e) => {
      const approved = e.requests.filter((r) => r.status === 'approved').reduce((s, r) => s + r.amount, 0);
      const pending  = e.requests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
      const rejected = e.requests.filter((r) => r.status === 'rejected').reduce((s, r) => s + r.amount, 0);
      const queried  = e.requests.filter((r) => r.status === 'queried').reduce((s, r) => s + r.amount, 0);
      return { name: e.name, approved, pending, rejected, queried };
    });
  }, [entities]);

  // ── Toggle entity ──────────────────────────────────────────────────────────

  function toggleEntity(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 4) return prev; // max 4
      return [...prev, slug];
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">Analytics</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Store &amp; Team Comparison</h1>
            <p className="mt-1 text-sm text-slate-500">Select up to 4 stores or team members to compare side-by-side</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${period === opt.value ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Entity picker ───────────────────────────────────────────────── */}
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-slate-400">Loading entities…</p>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Stores</p>
              <div className="flex flex-wrap gap-2">
                {stores.map((s) => {
                  const key = `store:${s.id}`;
                  const active = selected.includes(key);
                  const idx    = selected.indexOf(key);
                  return (
                    <button key={key} onClick={() => toggleEntity(key)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                      style={active ? { background: PALETTE[idx % PALETTE.length] } : {}}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Field Team</p>
              <div className="flex flex-wrap gap-2">
                {fieldUsers.map((u) => {
                  const key = `employee:${u.id}`;
                  const active = selected.includes(key);
                  const idx    = selected.indexOf(key);
                  return (
                    <button key={key} onClick={() => toggleEntity(key)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                      style={active ? { background: PALETTE[idx % PALETTE.length] } : {}}>
                      {u.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {entities.length === 0 && (
          <p className="mt-16 text-center text-sm text-slate-400">Select at least one store or team member above.</p>
        )}

        {entities.length > 0 && (
          <div className="mt-8 space-y-8">

            {/* ── KPI cards ─────────────────────────────────────────────── */}
            <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${entities.length}, minmax(0, 1fr))` }}>
              {entities.map((e) => (
                <Card key={e.key} className="p-5 space-y-3" style={{ borderTop: `3px solid ${e.color}` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{e.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{e.type}</p>
                    </div>
                    <Link href={`/dashboard/${e.type === 'store' ? 'store' : 'employee'}/${e.slug}`}
                      className="text-xs text-sky-600 hover:underline whitespace-nowrap">View →</Link>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(e.totalSpent)}</p>
                    <p className="text-xs text-slate-500">of {formatCurrency(e.budget)} budget</p>
                  </div>
                  {/* mini bar */}
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${e.pct}%`, background: healthColor(e.pct) }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: healthColor(e.pct) }} className="font-semibold">{e.pct.toFixed(0)}% used</span>
                    <span className="text-slate-400">{formatCurrency(Math.max(e.budget - e.totalSpent, 0))} left</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                    <div>
                      <p className="text-slate-400">Approved</p>
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(e.requests.filter((r) => r.status === 'approved').reduce((s, r) => s + r.amount, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Pending</p>
                      <p className="font-semibold text-amber-600">
                        {formatCurrency(e.requests.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0))}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* ── Spend vs Budget grouped bar ────────────────────────────── */}
            <div>
              <p className="mb-4 text-base font-semibold text-slate-800">Spend vs Budget</p>
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={entities.map((e) => ({ name: e.name.split(' ')[0], spent: e.totalSpent, budget: e.budget }))}
                    margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="spent"  name="Spent"  radius={[4, 4, 0, 0]}
                      fill="#0ea5e9"
                      label={false}>
                      {entities.map((e) => (
                        <rect key={e.key} fill={e.color} />
                      ))}
                    </Bar>
                    <Bar dataKey="budget" name="Budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── 6-month trend lines ────────────────────────────────────── */}
            <div>
              <p className="mb-4 text-base font-semibold text-slate-800">6-Month Spend Trend</p>
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {entities.map((e) => (
                      <Line key={e.key} type="monotone" dataKey={e.name} stroke={e.color}
                        strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* ── Category breakdown side by side ───────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-4 text-base font-semibold text-slate-800">Category Breakdown</p>
                <Card className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryBarData} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      {entities.map((e) => (
                        <Bar key={e.key} dataKey={e.name} fill={e.color} radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {entities.length >= 2 && (
                <div>
                  <p className="mb-4 text-base font-semibold text-slate-800">Radar — Category Shape</p>
                  <Card className="p-4">
                    <ResponsiveContainer width="100%" height={240}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} tick={{ fontSize: 9 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        {entities.map((e) => (
                          <Radar key={e.key} name={e.name} dataKey={e.name}
                            stroke={e.color} fill={e.color} fillOpacity={0.12} strokeWidth={2} />
                        ))}
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}
            </div>

            {/* ── Delta table ────────────────────────────────────────────── */}
            {entities.length >= 2 && (
              <div>
                <p className="mb-4 text-base font-semibold text-slate-800">
                  Δ Difference — {entities[0].name} vs {entities[1].name}
                </p>
                <Card className="overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Category</th>
                        {entities.map((e) => <th key={e.key} className="px-4 py-3 text-right">{e.name}</th>)}
                        <th className="px-4 py-3 text-right">Δ</th>
                        <th className="px-4 py-3 text-right">Δ %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {allCategories.map((cat) => {
                        const vals = entities.map((e) => e.byCategory.find((c) => c.category === cat)?.total ?? 0);
                        const delta   = vals[0] - (vals[1] ?? 0);
                        const deltaPct = vals[1] && vals[1] > 0 ? ((vals[0] - vals[1]) / vals[1]) * 100 : null;
                        return (
                          <tr key={cat} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{cat}</td>
                            {vals.map((v, i) => (
                              <td key={i} className="px-4 py-3 text-right font-semibold">{formatCurrency(v)}</td>
                            ))}
                            <td className={`px-4 py-3 text-right font-semibold ${delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {delta !== 0 ? `${delta > 0 ? '+' : ''}${formatCurrency(delta)}` : '—'}
                            </td>
                            <td className={`px-4 py-3 text-right text-xs font-medium ${delta > 0 ? 'text-rose-500' : delta < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                              {deltaPct !== null ? `${delta > 0 ? '+' : ''}${deltaPct.toFixed(0)}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* totals row */}
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-4 py-3">Total</td>
                        {entities.map((e) => <td key={e.key} className="px-4 py-3 text-right">{formatCurrency(e.totalSpent)}</td>)}
                        <td className={`px-4 py-3 text-right ${entities[0].totalSpent - (entities[1]?.totalSpent ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(Math.abs(entities[0].totalSpent - (entities[1]?.totalSpent ?? 0)))}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400">
                          {entities[1] && entities[1].totalSpent > 0
                            ? `${(((entities[0].totalSpent - entities[1].totalSpent) / entities[1].totalSpent) * 100).toFixed(0)}%`
                            : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* ── Request status comparison ──────────────────────────────── */}
            <div>
              <p className="mb-4 text-base font-semibold text-slate-800">Request Status by Value</p>
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={statusData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="approved" fill="#10b981" radius={[4, 4, 0, 0]} name="Approved" stackId="a" />
                    <Bar dataKey="pending"  fill="#f59e0b" radius={[0, 0, 0, 0]} name="Pending"  stackId="a" />
                    <Bar dataKey="queried"  fill="#0ea5e9" radius={[0, 0, 0, 0]} name="Queried"  stackId="a" />
                    <Bar dataKey="rejected" fill="#ef4444" radius={[0, 0, 4, 4]} name="Rejected" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
