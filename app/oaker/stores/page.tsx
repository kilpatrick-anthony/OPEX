'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { OakerNavbar } from '@/components/OakerNavbar';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import type { OakerMode } from '@/lib/oaker';

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
  isOfficial: boolean;
};

type OakerPayload = {
  inspections?: Inspection[];
  latestByStore?: Inspection[];
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OakerStoresPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [checkScope, setCheckScope] = useState<'combined' | 'official' | 'local'>('combined');
const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [focusStoreId, setFocusStoreId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/oaker?mode=express&limit=500', { cache: 'no-store' });
        const payload = (await readJsonSafely(response)) as OakerPayload | null;
        if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load store breakdown'));
        const latest = Array.isArray(payload?.latestByStore) ? payload.latestByStore : [];
        setInspections(Array.isArray(payload?.inspections) ? payload.inspections : []);
        if (latest[0]) setCompareA(String(latest[0].storeId));
        if (latest[1]) setCompareB(String(latest[1].storeId));
        if (latest[0]) setFocusStoreId(String(latest[0].storeId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load store breakdown');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, userLoading, router]);

  const scopedInspections = useMemo(() => inspections.filter((inspection) => (
    checkScope === 'combined' || (checkScope === 'official' ? inspection.isOfficial : !inspection.isOfficial)
  )), [inspections, checkScope]);
  const scopedLatestByStore = useMemo(() => {
    const latest = new Map<number, Inspection>();
    scopedInspections.forEach((inspection) => {
      if (!latest.has(inspection.storeId)) latest.set(inspection.storeId, inspection);
    });
    return Array.from(latest.values());
  }, [scopedInspections]);

  const storeRows = useMemo(() => {
    return scopedLatestByStore
      .map((store) => {
        const history = scopedInspections.filter((inspection) => inspection.storeId === store.storeId);
        const fullChecks = history.filter((inspection) => inspection.mode === 'experience').length;
        const expressChecks = history.filter((inspection) => inspection.mode === 'express').length;
        const previous = history.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[1];
        return {
          ...store,
          checks: history.length,
          fullChecks,
          expressChecks,
          average: average(history.map((inspection) => inspection.percentage)),
          change: previous ? Math.round((store.percentage - previous.percentage) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || a.storeName.localeCompare(b.storeName));
  }, [scopedInspections, scopedLatestByStore]);

  const selectedStores = useMemo(() => {
    return [compareA, compareB]
      .filter(Boolean)
      .map((id) => storeRows.find((store) => String(store.storeId) === id))
      .filter((store): store is (typeof storeRows)[number] => Boolean(store));
  }, [compareA, compareB, storeRows]);

  const comparisonData = selectedStores.map((store) => ({
    store: store.storeName,
    latest: Math.round(store.percentage * 10) / 10,
    average: Math.round(store.average * 10) / 10,
  }));

  const focusStore = storeRows.find((store) => String(store.storeId) === focusStoreId) ?? storeRows[0];
  const focusHistory = useMemo(() => {
    if (!focusStore) return [];
    return scopedInspections
      .filter((inspection) => inspection.storeId === focusStore.storeId)
      .slice()
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }, [focusStore, scopedInspections]);
  const focusTrend = focusHistory.map((inspection) => ({
    date: formatDate(inspection.submittedAt).replace(` ${new Date(inspection.submittedAt).getFullYear()}`, ''),
    score: Math.round(inspection.percentage * 10) / 10,
  }));
  const focusModeMix = [
    { name: 'Full', value: focusHistory.filter((inspection) => inspection.mode === 'experience').length, color: '#10b981' },
    { name: 'Express', value: focusHistory.filter((inspection) => inspection.mode === 'express').length, color: '#0ea5e9' },
  ];
  const focusBest = focusHistory.length ? Math.max(...focusHistory.map((inspection) => inspection.percentage)) : 0;
  const focusLow = focusHistory.length ? Math.min(...focusHistory.map((inspection) => inspection.percentage)) : 0;

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OakerNavbar />
        <main className="container py-10 text-sm text-slate-500">Loading store breakdown...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container py-6 md:py-10">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-600">OAKER Experience</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Store Breakdown</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Compare latest scores, historical averages, check volume, and movement store by store.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
          <span className="px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Statistics</span>
          {(['combined', 'official', 'local'] as const).map((scope) => (
            <button key={scope} type="button" onClick={() => setCheckScope(scope)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${checkScope === scope ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {scope}
            </button>
          ))}
        </div>

        {error ? <p className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card title="Compare Stores" description="Select two stores to compare latest and average scores." className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Store A
                <select value={compareA} onChange={(event) => setCompareA(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal">
                  {storeRows.map((store) => <option key={store.storeId} value={store.storeId}>{store.storeName}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Store B
                <select value={compareB} onChange={(event) => setCompareB(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal">
                  {storeRows.map((store) => <option key={store.storeId} value={store.storeId}>{store.storeName}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3">
              {selectedStores.map((store) => (
                <div key={store.storeId} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{store.storeName}</p>
                    <p className="text-xl font-bold text-slate-900">{store.percentage.toFixed(1)}%</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{store.checks} checks · {store.fullChecks} full · {store.expressChecks} express · {store.change >= 0 ? '+' : ''}{store.change.toFixed(1)} pts</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Score Comparison" description="Latest score versus historical average." className="space-y-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="store" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis domain={[60, 100]} tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="latest" name="Latest" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="average" name="Average" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {focusStore ? (
          <div className="mt-6 space-y-6">
            <Card title="Focus on One Store" description="Select a location to view its own history, movement, and report trail." className="space-y-5">
              <label className="block max-w-md text-sm font-medium text-slate-700">
                Store
                <select value={String(focusStore.storeId)} onChange={(event) => setFocusStoreId(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal">
                  {storeRows.map((store) => <option key={store.storeId} value={store.storeId}>{store.storeName}</option>)}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Latest score</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{focusStore.percentage.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Average score</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{focusStore.average.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Best score</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-600">{focusBest.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Lowest score</p>
                  <p className="mt-2 text-3xl font-semibold text-amber-600">{focusLow.toFixed(1)}%</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card title={`${focusStore.storeName} Score Trend`} description="Every OAKER Experience check over time." className="space-y-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={focusTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 12 }} />
                      <YAxis domain={[60, 100]} tick={{ fill: '#475569', fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                      <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Check Type Mix" description="Full Experience versus Express activity." className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={focusModeMix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                        {focusModeMix.map((item) => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value} checks`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card title={`${focusStore.storeName} Past Checks`} description="Report trail for this location." className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Mode</th>
                      <th className="px-4 py-3 text-left">Inspector</th>
                      <th className="px-4 py-3 text-left">Report</th>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {focusHistory.slice().reverse().map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell>{formatDate(inspection.submittedAt)}</TableCell>
                        <TableCell className="font-semibold text-slate-900">{inspection.percentage.toFixed(1)}%</TableCell>
                        <TableCell>{inspection.mode === 'experience' ? 'Full' : 'Express'}</TableCell>
                        <TableCell>{inspection.inspectorName}</TableCell>
                        <TableCell>
                          <a href={`/api/oaker/${inspection.id}/pdf`} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Download PDF</a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          </div>
        ) : null}

        <div className="mt-6">
          <Card title="All Stores" description="Latest OAKER Experience position by store." className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Latest</th>
                    <th className="px-4 py-3 text-left">Average</th>
                    <th className="px-4 py-3 text-left">Change</th>
                    <th className="px-4 py-3 text-left">Checks</th>
                    <th className="px-4 py-3 text-left">Last checked</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {storeRows.map((store) => (
                    <TableRow key={store.storeId}>
                      <TableCell className="font-semibold text-slate-900">{store.storeName}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{store.percentage.toFixed(1)}%</TableCell>
                      <TableCell>{store.average.toFixed(1)}%</TableCell>
                      <TableCell className={store.change >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>{store.change >= 0 ? '+' : ''}{store.change.toFixed(1)}</TableCell>
                      <TableCell>{store.checks}</TableCell>
                      <TableCell>{formatDate(store.submittedAt)}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{store.rating}</span>
                      </TableCell>
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
