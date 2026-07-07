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
  editReason?: string | null;
  editedAt?: string | null;
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
    accepted?: string[];
    rejected?: string[];
    messageId?: string;
  };
};

type EditDraft = {
  notes: string;
  editReason: string;
  responses: Record<number, { answer: OakerAnswer; comments: string }>;
};

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function createEditDraft(report: InspectionDetail): EditDraft {
  return {
    notes: report.notes ?? '',
    editReason: '',
    responses: Object.fromEntries(report.responses.map((response) => [
      response.id,
      { answer: response.answer, comments: response.comments ?? '' },
    ])),
  };
}

export default function OakerReportsPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [storeFilter, setStoreFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState<'all' | OakerMode>('all');
  const [selectedReport, setSelectedReport] = useState<InspectionDetail | null>(null);
  const [emailReportTarget, setEmailReportTarget] = useState<Inspection | InspectionDetail | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [deleteReportTarget, setDeleteReportTarget] = useState<Inspection | InspectionDetail | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [emailingReportId, setEmailingReportId] = useState<number | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canDeleteReports = user?.role === 'super_admin';
  const canEditReports = user?.role === 'super_admin' || user?.role === 'director';

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
      if (payload?.inspection) {
        setSelectedReport(payload.inspection);
        setEditDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  }

  function startEditReport() {
    if (!selectedReport || !canEditReports) return;
    setEditDraft(createEditDraft(selectedReport));
    setError('');
    setSuccess('');
  }

  function cancelEditReport() {
    setEditDraft(null);
    setError('');
  }

  async function saveReportEdit() {
    if (!selectedReport || !editDraft || !canEditReports) return;
    if (!editDraft.editReason.trim()) {
      setError('Enter a reason for editing this check.');
      return;
    }

    setSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/oaker/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editDraft.notes,
          editReason: editDraft.editReason,
          responses: selectedReport.responses.map((item) => ({
            id: item.id,
            answer: editDraft.responses[item.id]?.answer ?? item.answer,
            comments: editDraft.responses[item.id]?.comments ?? '',
          })),
        }),
      });
      const payload = (await readJsonSafely(response)) as { inspection?: InspectionDetail } | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to update check'));
      if (!payload?.inspection) throw new Error('Updated check was not returned.');

      setSelectedReport(payload.inspection);
      setInspections((current) => current.map((inspection) => (
        inspection.id === payload.inspection!.id
          ? {
              ...inspection,
              score: payload.inspection!.score,
              maxScore: payload.inspection!.maxScore,
              percentage: payload.inspection!.percentage,
              rating: payload.inspection!.rating,
              editReason: payload.inspection!.editReason,
              editedAt: payload.inspection!.editedAt,
            }
          : inspection
      )));
      setEditDraft(null);
      setSuccess('OAKER check updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update check');
    } finally {
      setSavingEdit(false);
    }
  }

  function openEmailDialog(report: Inspection | InspectionDetail) {
    setEmailReportTarget(report);
    setRecipientInput('');
    setError('');
    setSuccess('');
  }

  async function emailReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailReportTarget) return;

    const recipients = recipientInput
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setError('Enter at least one email address.');
      return;
    }

    const id = emailReportTarget.id;
    setEmailingReportId(id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/oaker/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      });
      const payload = (await readJsonSafely(response)) as EmailPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to email report'));
      if (payload?.emailStatus?.sent) {
        const accepted = payload.emailStatus.accepted?.length ? ` Accepted by SMTP: ${payload.emailStatus.accepted.join(', ')}.` : '';
        setSuccess(`Report email sent for ${payload.emailStatus.recipientCount} recipient${payload.emailStatus.recipientCount === 1 ? '' : 's'}.${accepted}`);
        setEmailReportTarget(null);
        setRecipientInput('');
      } else {
        const rejected = payload?.emailStatus?.rejected?.length ? ` Rejected: ${payload.emailStatus.rejected.join(', ')}.` : '';
        setError(`Report email was not sent (${payload?.emailStatus?.reason ?? 'unknown reason'}).${rejected}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to email report');
    } finally {
      setEmailingReportId(null);
    }
  }

  async function deleteReport() {
    if (!deleteReportTarget) return;

    const id = deleteReportTarget.id;
    setDeletingReportId(id);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/oaker/${id}`, { method: 'DELETE' });
      const payload = (await readJsonSafely(response)) as { error?: string } | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to delete report'));

      setInspections((current) => current.filter((inspection) => inspection.id !== id));
      setSelectedReport((current) => (current?.id === id ? null : current));
      setDeleteReportTarget(null);
      setSuccess('OAKER check deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setDeletingReportId(null);
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
                            onClick={() => openEmailDialog(inspection)}
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
                          {canDeleteReports ? (
                            <button
                              type="button"
                              onClick={() => setDeleteReportTarget(inspection)}
                              disabled={deletingReportId === inspection.id}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-60"
                            >
                              Delete
                            </button>
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
        onClose={() => {
          if (savingEdit) return;
          setSelectedReport(null);
          setEditDraft(null);
        }}
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
                onClick={() => openEmailDialog(selectedReport)}
                disabled={emailingReportId === selectedReport.id || !!editDraft}
                className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {emailingReportId === selectedReport.id ? 'Emailing...' : 'Email report'}
              </button>
              {selectedReport.reportPath ? <a href={selectedReport.reportPath} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700">Open original PDF</a> : null}
              {canEditReports ? (
                editDraft ? (
                  <>
                    <button
                      type="button"
                      onClick={saveReportEdit}
                      disabled={savingEdit}
                      className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {savingEdit ? 'Saving...' : 'Save edit'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditReport}
                      disabled={savingEdit}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
                    >
                      Cancel edit
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startEditReport}
                    className="rounded-xl bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    Edit check
                  </button>
                )
              ) : null}
              {canDeleteReports ? (
                <button
                  type="button"
                  onClick={() => setDeleteReportTarget(selectedReport)}
                  disabled={deletingReportId === selectedReport.id || !!editDraft}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  Delete check
                </button>
              ) : null}
            </div>

            {selectedReport.editedAt ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-amber-700">Edited check</p>
                <p className="mt-2 text-slate-700">
                  Edited on {formatDate(selectedReport.editedAt)}{selectedReport.editReason ? `: ${selectedReport.editReason}` : '.'}
                </p>
              </div>
            ) : null}

            {editDraft ? (
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Reason for editing
                  <textarea
                    value={editDraft.editReason}
                    onChange={(event) => setEditDraft((current) => current ? { ...current, editReason: event.target.value } : current)}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400"
                    placeholder="Explain why this completed check is being amended."
                    disabled={savingEdit}
                  />
                </label>
              </div>
            ) : null}

            {editDraft ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall Notes</p>
                <textarea
                  value={editDraft.notes}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, notes: event.target.value } : current)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-300 focus:bg-white"
                  disabled={savingEdit}
                />
              </div>
            ) : selectedReport.notes ? (
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
                    {editDraft ? (
                      <select
                        value={editDraft.responses[response.id]?.answer ?? response.answer}
                        onChange={(event) => setEditDraft((current) => current ? {
                          ...current,
                          responses: {
                            ...current.responses,
                            [response.id]: {
                              answer: event.target.value as OakerAnswer,
                              comments: current.responses[response.id]?.comments ?? response.comments ?? '',
                            },
                          },
                        } : current)}
                        disabled={savingEdit}
                        className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 outline-none"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="capex">Capex</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{response.answer}</span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{response.standard}</p>
                  {editDraft ? (
                    <textarea
                      value={editDraft.responses[response.id]?.comments ?? ''}
                      onChange={(event) => setEditDraft((current) => current ? {
                        ...current,
                        responses: {
                          ...current.responses,
                          [response.id]: {
                            answer: current.responses[response.id]?.answer ?? response.answer,
                            comments: event.target.value,
                          },
                        },
                      } : current)}
                      rows={2}
                      placeholder="Comments"
                      disabled={savingEdit}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-300 focus:bg-white"
                    />
                  ) : response.comments ? <p className="mt-1 text-slate-600">{response.comments}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading report...</p>
        )}
      </Dialog>

      <Dialog
        open={!!emailReportTarget}
        title="Email Report"
        description={emailReportTarget ? `${emailReportTarget.storeName} · ${formatDate(emailReportTarget.submittedAt)}` : ''}
        onClose={() => {
          if (emailingReportId) return;
          setEmailReportTarget(null);
          setRecipientInput('');
        }}
      >
        {emailReportTarget ? (
          <form onSubmit={emailReport} className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Recipient email addresses
              <textarea
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
                rows={4}
                placeholder="name@oakberry.ie, another@example.com"
                className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-emerald-300 focus:bg-white"
                disabled={emailingReportId === emailReportTarget.id}
              />
            </label>
            <p className="text-xs text-slate-500">Separate multiple addresses with commas, semicolons, or new lines.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmailReportTarget(null);
                  setRecipientInput('');
                }}
                disabled={emailingReportId === emailReportTarget.id}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailingReportId === emailReportTarget.id}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {emailingReportId === emailReportTarget.id ? 'Sending...' : 'Send report'}
              </button>
            </div>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={!!deleteReportTarget}
        title="Delete Check"
        description={deleteReportTarget ? `${deleteReportTarget.storeName} · ${formatDate(deleteReportTarget.submittedAt)}` : ''}
        onClose={() => {
          if (deletingReportId) return;
          setDeleteReportTarget(null);
        }}
      >
        {deleteReportTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will permanently remove the OAKER check and its responses from the system.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteReportTarget(null)}
                disabled={deletingReportId === deleteReportTarget.id}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteReport}
                disabled={deletingReportId === deleteReportTarget.id}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {deletingReportId === deleteReportTarget.id ? 'Deleting...' : 'Delete check'}
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
