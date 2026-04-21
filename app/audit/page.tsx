'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { formatCurrency, readJsonSafely, getApiErrorMessage } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';

type AuditEntry = {
  id: number;
  action: 'approved' | 'rejected' | 'queried';
  comment: string | null;
  createdAt: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  requestId: number;
  requestCategory: string;
  requestAmount: number;
  storeName: string;
  requesterName: string;
};

const ACTION_STYLES: Record<AuditEntry['action'], string> = {
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  queried:  'bg-sky-50 text-sky-700 border border-sky-200',
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

export default function AuditPage() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Filters
  const [actorFilter, setActorFilter]   = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!isLoading && user && !['director', 'super_admin'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  async function loadAudit() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (actorFilter) params.set('actorId', actorFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const url = params.toString() ? `/api/audit?${params.toString()}` : '/api/audit';
      const res = await fetch(url, { cache: 'no-store' });
      const payload = await readJsonSafely(res);
      if (!res.ok) throw new Error(getApiErrorMessage(res, payload, 'Failed to load audit trail'));
      setEntries(Array.isArray((payload as any)?.entries) ? (payload as any).entries : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && ['director', 'super_admin'].includes(user.role)) {
      loadAudit();
    }
  }, [user]);

  // Unique actors derived from loaded entries (for filter dropdown)
  const actors = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) map.set(e.actorId, e.actorName);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  // Client-side filter (on top of server filters already applied)
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actorFilter && String(e.actorId) !== actorFilter) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      return true;
    });
  }, [entries, actorFilter, actionFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const approved = filtered.filter((e) => e.action === 'approved').length;
    const rejected = filtered.filter((e) => e.action === 'rejected').length;
    const queried  = filtered.filter((e) => e.action === 'queried').length;
    const totalValue = filtered
      .filter((e) => e.action === 'approved')
      .reduce((s, e) => s + e.requestAmount, 0);
    return { approved, rejected, queried, totalValue };
  }, [filtered]);

  function handleExportCsv() {
    const rows: string[][] = [
      ['Date', 'Actor', 'Role', 'Action', 'Request #', 'Store', 'Requester', 'Category', 'Amount', 'Comment'],
      ...filtered.map((e) => [
        format(new Date(e.createdAt), 'd MMM yyyy HH:mm'),
        e.actorName,
        e.actorRole,
        e.action,
        String(e.requestId),
        e.storeName,
        e.requesterName,
        e.requestCategory,
        e.requestAmount.toFixed(2),
        e.comment ?? '',
      ]),
    ];
    downloadCsv(rows, `opex-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">Governance</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Audit Trail</h1>
            <p className="mt-1 text-sm text-slate-500">A full record of every approval, rejection, and query action.</p>
          </div>
          <Button variant="secondary" onClick={handleExportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        </div>

        {/* KPI strip */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Approved</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-600">{stats.approved}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Rejected</p>
            <p className="mt-3 text-3xl font-semibold text-rose-600">{stats.rejected}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Queried</p>
            <p className="mt-3 text-3xl font-semibold text-sky-600">{stats.queried}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">Approved value</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(stats.totalValue)}</p>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Filters</p>
          <div className="flex flex-wrap gap-3">
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All directors / admins</option>
              {actors.map(([id, name]) => (
                <option key={id} value={String(id)}>{name}</option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All actions</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="queried">Queried</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            </div>
            <Button
              type="button"
              onClick={loadAudit}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Apply'}
            </Button>
            {(actorFilter || actionFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setActorFilter('');
                  setActionFilter('');
                  setDateFrom('');
                  setDateTo('');
                  loadAudit();
                }}
                className="text-xs text-slate-400 hover:text-slate-600 underline self-center"
              >
                Clear filters
              </button>
            )}
          </div>
        </Card>

        {/* Table */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm uppercase tracking-widest text-slate-500">Audit entries</p>
            <span className="text-xs text-slate-400">{filtered.length} records</span>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading audit trail…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No audit entries match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Date &amp; Time</th>
                    <th className="px-4 py-3 text-left">Actor</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Request #</th>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Note</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500">
                        {format(new Date(e.createdAt), 'd MMM yyyy')}{' '}
                        <span className="text-slate-400">{format(new Date(e.createdAt), 'HH:mm')}</span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{e.actorName}</div>
                        <div className="text-xs capitalize text-slate-400">{e.actorRole.replace('_', ' ')}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_STYLES[e.action]}`}>
                          {e.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">#{e.requestId}</TableCell>
                      <TableCell className="text-sm text-slate-700">{e.storeName}</TableCell>
                      <TableCell className="text-sm text-slate-700">{e.requesterName}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">{e.requestCategory}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(e.requestAmount)}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-slate-500 italic">
                        {e.comment ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
