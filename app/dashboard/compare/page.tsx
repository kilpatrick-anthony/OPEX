'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Card }   from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { formatCurrency } from '@/lib/utils';
import { STORE_DETAILS, EMPLOYEE_DETAILS, ALL_STORES, ALL_EMPLOYEES, type Period, type EntityPeriodData } from '@/lib/mockData';

const PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#7c3aed', '#ef4444', '#0284c7'];

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'Quarter',    value: 'quarter' },
];

const ALL_ENTITIES = [
  ...ALL_STORES.map((s) => ({ ...s, type: 'store' as const })),
  ...ALL_EMPLOYEES.map((e) => ({ ...e, type: 'employee' as const })),
];

type CompareEntity = {
  slug:        string;
  name:        string;
  type:        'store' | 'employee';
  totalSpent:  number;
  budget:      number;
  pct:         number;
  byCategory:  EntityPeriodData['byCategory'];
  trend:       { month: string; total: number }[];
  requests:    EntityPeriodData['requests'];
  color:       string;
};

function getBudgetPct(spent: number, budget: number) {
  return budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
}

function healthColor(pct: number) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f59e0b';
  return '#10b981';
}

export default function ComparePage() {
  const [period,   setPeriod]   = useState<Period>('month');
  const [selected, setSelected] = useState<string[]>(['anne-street', 'cork']);

  // ── Derived data per selected entity ──────────────────────────────────────

  const entities = useMemo<CompareEntity[]>(() => {
    return selected.flatMap((slug, idx) => {
      const src = STORE_DETAILS[slug] ?? EMPLOYEE_DETAILS[slug];
      if (!src) return [];
      const data = src[period];
      const pct  = getBudgetPct(data.totalSpent, data.budget);
      return [{
        slug, name: src.name, type: src.type,
        totalSpent: data.totalSpent, budget: data.budget, pct,
        byCategory: data.byCategory, trend: src.trend, requests: data.requests,
        color: PALETTE[idx % PALETTE.length],
      }];
    });
  }, [selected, period]);

  // ── Category comparison (radar + grouped bar) ──────────────────────────────

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
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Stores</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STORES.map((s) => {
              const active = selected.includes(s.slug);
              const idx    = selected.indexOf(s.slug);
              return (
                <button key={s.slug} onClick={() => toggleEntity(s.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  style={active ? { background: PALETTE[idx % PALETTE.length] } : {}}>
                  {s.name}
                </button>
              );
            })}
          </div>
          <p className="mt-4 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Field Team</p>
          <div className="flex flex-wrap gap-2">
            {ALL_EMPLOYEES.map((e) => {
              const active = selected.includes(e.slug);
              const idx    = selected.indexOf(e.slug);
              return (
                <button key={e.slug} onClick={() => toggleEntity(e.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                  style={active ? { background: PALETTE[idx % PALETTE.length] } : {}}>
                  {e.name}
                </button>
              );
            })}
          </div>
        </div>

        {entities.length === 0 && (
          <p className="mt-16 text-center text-sm text-slate-400">Select at least one store or team member above.</p>
        )}

        {entities.length > 0 && (
          <div className="mt-8 space-y-8">

            {/* ── KPI cards ─────────────────────────────────────────────── */}
            <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${entities.length}, minmax(0, 1fr))` }}>
              {entities.map((e) => (
                <Card key={e.slug} className="p-5 space-y-3" style={{ borderTop: `3px solid ${e.color}` }}>
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
                        <rect key={e.slug} fill={e.color} />
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
                      <Line key={e.slug} type="monotone" dataKey={e.name} stroke={e.color}
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
                        <Bar key={e.slug} dataKey={e.name} fill={e.color} radius={[0, 4, 4, 0]} />
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
                          <Radar key={e.slug} name={e.name} dataKey={e.name}
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
                        {entities.map((e) => <th key={e.slug} className="px-4 py-3 text-right">{e.name}</th>)}
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
                        {entities.map((e) => <td key={e.slug} className="px-4 py-3 text-right">{formatCurrency(e.totalSpent)}</td>)}
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
