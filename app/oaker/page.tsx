'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { OakerNavbar } from '@/components/OakerNavbar';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import type { OakerMode } from '@/lib/oaker';

type Store = {
  id: number;
  name: string;
};

type Inspection = {
  id: number;
  storeId: number;
  storeName: string;
  inspectorName: string;
  mode: OakerMode;
  score: number;
  maxScore: number;
  percentage: number;
  rating: string;
  submittedAt: string;
};

type OakerPayload = {
  stores?: Store[];
  inspections?: Inspection[];
  latestByStore?: Inspection[];
};

type StoreGroup = {
  title: string;
  description: string;
  stores: Inspection[];
};

const RATING_STYLES: Record<string, string> = {
  Green: 'bg-emerald-50 text-emerald-700',
  Amber: 'bg-amber-50 text-amber-700',
  Red: 'bg-rose-50 text-rose-700',
};

const RATING_COLORS: Record<string, string> = {
  Green: '#10b981',
  Amber: '#f59e0b',
  Red: '#f43f5e',
};

const SECTION_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6'];

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function monthKey(dateText: string) {
  const date = new Date(dateText);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(dateText: string) {
  return new Date(dateText).toLocaleDateString('en-IE', { month: 'short' });
}

export default function OakerDashboardPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [stores, setStores] = useState<Store[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [latestByStore, setLatestByStore] = useState<Inspection[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StoreGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/oaker?mode=express', { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as OakerPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load OAKER dashboard'));

      setStores(Array.isArray(payload?.stores) ? payload.stores : []);
      setInspections(Array.isArray(payload?.inspections) ? payload.inspections : []);
      setLatestByStore(Array.isArray(payload?.latestByStore) ? payload.latestByStore : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAKER dashboard');
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    loadDashboard();
  }, [user, userLoading, router]);

  const estateAverage = useMemo(() => average(latestByStore.map((inspection) => inspection.percentage)), [latestByStore]);
  const expertCount = useMemo(() => latestByStore.filter((inspection) => inspection.percentage >= 90).length, [latestByStore]);
  const classicCount = useMemo(() => latestByStore.filter((inspection) => inspection.percentage >= 75 && inspection.percentage < 90).length, [latestByStore]);
  const risingCount = useMemo(() => latestByStore.filter((inspection) => inspection.percentage < 75).length, [latestByStore]);
  const recentCutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }, []);
  const recentInspections = useMemo(() => inspections.filter((inspection) => new Date(inspection.submittedAt) >= recentCutoff), [inspections, recentCutoff]);

  const leagueTable = useMemo(() => (
    latestByStore
      .slice()
      .sort((a, b) => b.percentage - a.percentage || a.storeName.localeCompare(b.storeName))
      .map((inspection, index) => ({ ...inspection, rank: index + 1 }))
  ), [latestByStore]);

  const trendData = useMemo(() => {
    const byMonth = inspections.reduce<Record<string, { key: string; month: string; values: number[] }>>((acc, inspection) => {
      const key = monthKey(inspection.submittedAt);
      if (!acc[key]) acc[key] = { key, month: monthLabel(inspection.submittedAt), values: [] };
      acc[key].values.push(inspection.percentage);
      return acc;
    }, {});

    return Object.values(byMonth)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({ month: item.month, score: Math.round(average(item.values) * 10) / 10 }));
  }, [inspections]);

  const ratingMix = useMemo(() => [
    { name: 'Green', value: expertCount, color: RATING_COLORS.Green, rating: 'Green' },
    { name: 'Amber', value: classicCount, color: RATING_COLORS.Amber, rating: 'Amber' },
    { name: 'Red', value: risingCount, color: RATING_COLORS.Red, rating: 'Red' },
  ], [expertCount, classicCount, risingCount]);

  const modeMix = useMemo(() => {
    const full = inspections.filter((inspection) => inspection.mode === 'experience').length;
    const express = inspections.filter((inspection) => inspection.mode === 'express').length;
    return [
      { name: 'Full', checks: full },
      { name: 'Express', checks: express },
    ];
  }, [inspections]);

  const momentum = useMemo(() => {
    const byStore = inspections.reduce<Record<number, Inspection[]>>((acc, inspection) => {
      if (!acc[inspection.storeId]) acc[inspection.storeId] = [];
      acc[inspection.storeId].push(inspection);
      return acc;
    }, {});

    return Object.values(byStore)
      .map((storeInspections) => {
        const sorted = storeInspections.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        const latest = sorted[0];
        const previous = sorted[1];
        return {
          ...latest,
          change: previous ? Math.round((latest.percentage - previous.percentage) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => a.change - b.change);
  }, [inspections]);

  const topMover = momentum.slice().sort((a, b) => b.change - a.change)[0];
  const needsAttention = leagueTable.filter((inspection) => inspection.percentage < 75).slice(0, 5);
  const latestInspection = inspections[0];

  function openStoreGroup(title: string, description: string, storesForGroup: Inspection[]) {
    setSelectedGroup({
      title,
      description,
      stores: storesForGroup.slice().sort((a, b) => b.percentage - a.percentage || a.storeName.localeCompare(b.storeName)),
    });
  }

  function storesForRating(rating: string) {
    return latestByStore.filter((inspection) => inspection.rating === rating);
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OakerNavbar />
        <main className="container py-10 text-sm text-slate-500">Loading OAKER dashboard...</main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OakerNavbar />
        <main className="container py-10">
          <p className="text-sm text-rose-600">{error}</p>
          <Button className="mt-4" onClick={loadDashboard}>Retry</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container w-full overflow-hidden pb-6 pt-8 md:py-10">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-widest text-emerald-600">OAKER Experience</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">OAKER Experience Dashboard</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Estate-level scoring, store ranking, and standards signals from the latest OAKER Experience checks.
            </p>
          </div>
          <Link
            href="/oaker/checks"
            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-white shadow-lg shadow-amber-300/60 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
            style={{ backgroundColor: '#6d2f8e' }}
            onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = '#4a1f60'; }}
            onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = '#6d2f8e'; }}
          >
            New Check
          </Link>
        </div>

        <div className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Estate score</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{estateAverage.toFixed(1)}%</p>
            <p className="mt-2 text-sm text-slate-500">Latest score across {latestByStore.length} stores</p>
          </div>
          <button
            type="button"
            onClick={() => openStoreGroup('Green Rated Stores', 'Stores currently scoring at or above 90%.', storesForRating('Green'))}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
          >
            <p className="text-xs uppercase tracking-widest text-slate-500">Green Rated Stores</p>
            <p className="mt-3 text-4xl font-semibold text-emerald-600">{expertCount}</p>
            <p className="mt-2 text-sm text-slate-500">At or above 90%</p>
          </button>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Checks this month</p>
            <p className="mt-3 text-4xl font-semibold text-sky-600">{recentInspections.length}</p>
            <p className="mt-2 text-sm text-slate-500">Rolling 30-day activity</p>
          </div>
          <button
            type="button"
            onClick={() => openStoreGroup('Red Rated Stores', 'Stores currently scoring below 75%.', storesForRating('Red'))}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg"
          >
            <p className="text-xs uppercase tracking-widest text-slate-500">Red Rated Stores</p>
            <p className="mt-3 text-4xl font-semibold text-rose-600">{risingCount}</p>
            <p className="mt-2 text-sm text-slate-500">Stores below 75%</p>
          </button>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card title="OAKER Score Trend" description="Average score by inspection month." className="min-w-0 space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis domain={[60, 100]} tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Rating Mix" description="Current store distribution." className="min-w-0 space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratingMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={4}
                    onClick={(entry) => {
                      if (!entry?.rating) return;
                      openStoreGroup(`${entry.name} Rated Stores`, `Stores currently in the ${entry.name} rating group.`, storesForRating(entry.rating));
                    }}
                    cursor="pointer"
                  >
                    {ratingMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} stores`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2">
              {ratingMix.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => openStoreGroup(`${item.name} Rated Stores`, `Stores currently in the ${item.name} rating group.`, storesForRating(item.rating))}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm transition hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1fr_1fr]">
          <Card title="Store League Table" description="Latest score by store." className="min-w-0 space-y-4">
            <div className="-mx-2 overflow-x-auto px-2">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Rank</th>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {leagueTable.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-semibold text-slate-500">#{store.rank}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{store.storeName}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{store.percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${RATING_STYLES[store.rating] ?? 'bg-slate-100 text-slate-700'}`}>
                          {store.rating}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card title="Momentum Watch" description="Movement versus each store's previous check." className="min-w-0 space-y-4">
            <div className="grid gap-3">
              {topMover ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-emerald-700">Biggest improvement</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <p className="font-semibold text-emerald-950">{topMover.storeName}</p>
                    <p className="text-xl font-bold text-emerald-700">+{Math.max(topMover.change, 0).toFixed(1)} pts</p>
                  </div>
                </div>
              ) : null}
              {needsAttention.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  No stores are currently below the 75% threshold.
                </div>
              ) : (
                needsAttention.map((inspection) => (
                  <div key={inspection.id} className="min-w-0 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="min-w-0 font-semibold text-amber-950">{inspection.storeName}</p>
                      <p className="text-lg font-bold text-amber-700">{inspection.percentage.toFixed(1)}%</p>
                    </div>
                    <p className="mt-1 text-xs text-amber-700">Latest check on {formatDate(inspection.submittedAt)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card title="Check Mix" description="Full Experience versus Express checks." className="min-w-0 space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modeMix} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => `${value} checks`} />
                  <Bar dataKey="checks" radius={[8, 8, 0, 0]}>
                    {modeMix.map((entry, index) => (
                      <Cell key={entry.name} fill={SECTION_COLORS[index % SECTION_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Recent Checks" description="Latest submitted OAKER activity." className="min-w-0 space-y-4">
            <div className="-mx-2 overflow-x-auto px-2">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Inspector</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {inspections.slice(0, 10).map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-semibold text-slate-900">{inspection.storeName}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{inspection.percentage.toFixed(1)}%</TableCell>
                      <TableCell className="capitalize text-slate-600">{inspection.mode === 'experience' ? 'Full' : 'Express'}</TableCell>
                      <TableCell className="text-slate-500">{inspection.inspectorName}</TableCell>
                      <TableCell className="text-slate-500">{formatDate(inspection.submittedAt)}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Stores tracked</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stores.length}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total checks</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{inspections.length}</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Latest check</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{latestInspection ? formatDate(latestInspection.submittedAt) : 'None'}</p>
          </div>
        </div>
      </main>
      <Dialog
        open={!!selectedGroup}
        title={selectedGroup?.title ?? 'Stores'}
        description={selectedGroup?.description ?? ''}
        onClose={() => setSelectedGroup(null)}
      >
        {selectedGroup ? (
          <div className="space-y-3">
            {selectedGroup.stores.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No stores in this group.</p>
            ) : selectedGroup.stores.map((store) => (
              <div key={store.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{store.storeName}</p>
                  <p className="text-xs text-slate-500">Latest check: {formatDate(store.submittedAt)} · {store.mode === 'experience' ? 'Full' : 'Express'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">{store.percentage.toFixed(1)}%</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RATING_STYLES[store.rating] ?? 'bg-slate-100 text-slate-700'}`}>
                    {store.rating}
                  </span>
                </div>
              </div>
            ))}
            <Link href="/oaker/stores" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Open full store breakdown
            </Link>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
