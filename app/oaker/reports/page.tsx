'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { OakerNavbar } from '@/components/OakerNavbar';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import type { OakerAnswer, OakerMode } from '@/lib/oaker';

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
  reportPath?: string | null;
};

type InspectionDetail = Inspection & {
  notes: string | null;
  reportText?: string | null;
  responses: Array<{
    id: number;
    questionId: number;
    section: string;
    standard: string;
    weighting: number;
    answer: OakerAnswer;
    comments: string | null;
    photos: string[];
  }>;
};

type OakerPayload = {
  inspections?: Inspection[];
  latestByStore?: Inspection[];
};

type EmailPayload = {
  emailStatus?: {
    sent: boolean;
    provider?: string;
    recipientCount: number;
    reason?: string;
  };
};

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OakerReportsPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState<'all' | OakerMode>('all');
  const [selectedReport, setSelectedReport] = useState<InspectionDetail | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [emailingReportId, setEmailingReportId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    async function loadReports() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/oaker?mode=express&limit=500', { cache: 'no-store' });
        const payload = (await readJsonSafely(response)) as OakerPayload | null;
        if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load reports'));
        setInspections(Array.isArray(payload?.inspections) ? payload.inspections : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [user, userLoading, router]);

  const stores = useMemo(() => {
    return Array.from(new Set(inspections.map((inspection) => inspection.storeName))).sort((a, b) => a.localeCompare(b));
  }, [inspections]);

  const filteredReports = useMemo(() => {
    return inspections.filter((inspection) => {
      const storeMatches = storeFilter === 'all' || inspection.storeName === storeFilter;
      const modeMatches = modeFilter === 'all' || inspection.mode === modeFilter;
      return storeMatches && modeMatches;
    });
  }, [inspections, storeFilter, modeFilter]);

  async function openReport(id: number) {
    setLoadingReport(true);
    setError('');
    try {
      const response = await fetch(`/api/oaker/${id}`, { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as { inspection?: InspectionDetail } | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load report'));
      if (payload?.inspection) setSelectedReport(payload.inspection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  }

  async function emailReport(id: number) {
    setEmailingReportId(id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/oaker/${id}/email`, { method: 'POST' });
      const payload = (await readJsonSafely(response)) as EmailPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to email report'));
      if (payload?.emailStatus?.sent) {
        setSuccess(`Report email queued for ${payload.emailStatus.recipientCount} recipient${payload.emailStatus.recipientCount === 1 ? '' : 's'}.`);
      } else {
        setError(`Report email was not sent (${payload?.emailStatus?.reason ?? 'unknown reason'}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to email report');
    } finally {
      setEmailingReportId(null);
    }
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OakerNavbar />
        <main className="container py-10 text-sm text-slate-500">Loading reports...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container py-6 md:py-10">
        <div>
          <p className="text-sm uppercase tracking-widest text-emerald-600">OAKER Experience</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">View original uploaded reports and download generated PDF reports for every completed OAKER Experience check.</p>
        </div>

        {error ? <p className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total reports</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{inspections.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Original PDFs</p>
            <p className="mt-2 text-3xl font-semibold text-sky-600">{inspections.filter((inspection) => inspection.reportPath).length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-widest text-slate-500">Generated PDFs</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">{inspections.length}</p>
          </div>
        </div>

        <div className="mt-6">
          <Card title="Report Library" description="Filter, view, and download past OAKER Experience checks." className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Store
                <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal">
                  <option value="all">All stores</option>
                  {stores.map((store) => <option key={store} value={store}>{store}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Check type
                <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)} className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal">
                  <option value="all">All checks</option>
                  <option value="experience">Full OAKER Experience</option>
                  <option value="express">OAKER Express</option>
                </select>
              </label>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Inspector</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {filteredReports.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-semibold text-slate-900">{inspection.storeName}</TableCell>
                      <TableCell>{formatDate(inspection.submittedAt)}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{inspection.percentage.toFixed(1)}%</TableCell>
                      <TableCell>{inspection.mode === 'experience' ? 'Full' : 'Express'}</TableCell>
                      <TableCell>{inspection.inspectorName}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openReport(inspection.id)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            View
                          </button>
                          <a href={`/api/oaker/${inspection.id}/pdf`} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                            Download PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => emailReport(inspection.id)}
                            disabled={emailingReportId === inspection.id}
                            className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-60"
                          >
                            {emailingReportId === inspection.id ? 'Emailing...' : 'Email report'}
                          </button>
                          {inspection.reportPath ? (
                            <a href={inspection.reportPath} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                              Original PDF
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      </main>

      <Dialog
        open={!!selectedReport || loadingReport}
        title={selectedReport ? `${selectedReport.storeName} Report` : 'Loading report'}
        description={selectedReport ? `${selectedReport.mode === 'experience' ? 'Full OAKER Experience' : 'OAKER Express'} · ${formatDate(selectedReport.submittedAt)}` : ''}
        onClose={() => setSelectedReport(null)}
        className="max-h-[90vh] max-w-5xl overflow-y-auto"
      >
        {selectedReport ? (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Score</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{selectedReport.percentage.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Rating</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedReport.rating}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Inspector</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedReport.inspectorName}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Responses</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedReport.responses.length}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={`/api/oaker/${selectedReport.id}/pdf`} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Download generated PDF</a>
              <button
                type="button"
                onClick={() => emailReport(selectedReport.id)}
                disabled={emailingReportId === selectedReport.id}
                className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {emailingReportId === selectedReport.id ? 'Emailing...' : 'Email report'}
              </button>
              {selectedReport.reportPath ? <a href={selectedReport.reportPath} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700">Open original PDF</a> : null}
            </div>

            {selectedReport.notes ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Notes</p>
                <p className="mt-2 text-slate-700">{selectedReport.notes}</p>
              </div>
            ) : null}

            <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-100">
              {selectedReport.responses.map((response) => (
                <div key={response.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">#{response.questionId}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{response.section}</span>
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{response.answer}</span>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{response.standard}</p>
                  {response.comments ? <p className="mt-1 text-slate-600">{response.comments}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading report...</p>
        )}
      </Dialog>
    </div>
  );
}
