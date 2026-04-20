'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'queried';

type ApprovalRequest = {
  id: number;
  storeId: number;
  storeName: string;
  requesterName: string;
  submitterName?: string | null;
  submitterJobRole?: string | null;
  amount: number;
  category: string;
  description: string;
  receipt?: string | null;
  createdAt: string;
  storeRemainingBudget: number;
  status: RequestStatus;
  queryComment?: string;
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queried: 'bg-sky-50 text-sky-700',
};

export default function ApprovalPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [queryId, setQueryId] = useState<number | null>(null);
  const [queryReason, setQueryReason] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRequest, setViewRequest] = useState<ApprovalRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ request: ApprovalRequest; action: 'approved' | 'rejected' } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'approved' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadStores() {
    const response = await fetch('/api/stores', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load stores');
    const data = await readJsonSafely(response);
    setStores(Array.isArray(data) ? (data as Array<{ id: number; name: string }>) : []);
  }

  async function loadRequests() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (storeFilter) params.set('storeId', storeFilter);

    const url = params.toString() ? `/api/requests?${params.toString()}` : '/api/requests';
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await readJsonSafely(response);
    if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load requests'));
    setRequests(Array.isArray((payload as any)?.requests) ? (payload as any).requests : []);
  }

  useEffect(() => {
    let canceled = false;
    async function init() {
      setLoading(true);
      setError('');
      try {
        await Promise.all([loadStores(), loadRequests()]);
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : 'Failed to initialize approvals');
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    init();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    loadRequests().catch(() => setError('Failed to refresh requests'));
  }, [statusFilter, storeFilter]);

  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const approvedCount = requests.filter((request) => request.status === 'approved').length;
  const rejectedCount = requests.filter((request) => request.status === 'rejected').length;
  const queriedCount = requests.filter((request) => request.status === 'queried').length;

  function openReceiptInNewTab(receipt: string) {
    const [header, data] = receipt.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const actionableInView = requests.filter((request) => request.status === 'pending' || request.status === 'queried');
  const allViewSelected = actionableInView.length > 0 && actionableInView.every((request) => selected.has(request.id));

  const selectedInView = useMemo(
    () => actionableInView.filter((request) => selected.has(request.id)),
    [actionableInView, selected],
  );

  const selectedTotal = selectedInView.reduce((sum, request) => sum + request.amount, 0);

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allViewSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        actionableInView.forEach((request) => next.delete(request.id));
        return next;
      });
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      actionableInView.forEach((request) => next.add(request.id));
      return next;
    });
  }

  async function performAction(id: number, action: 'approved' | 'rejected' | 'queried', comment?: string) {
    const response = await fetch(`/api/requests/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: comment || '' }),
    });
    const payload = await readJsonSafely(response);
    if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to apply action'));
  }

  async function handleAction(id: number, action: 'approved' | 'rejected') {
    setError('');
    setConfirmAction(null);
    try {
      await performAction(id, action);
      await loadRequests();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process action');
    }
  }

  async function handleBulkAction(action: 'approved' | 'rejected') {
    setError('');
    try {
      await Promise.all(Array.from(selected).map((id) => performAction(id, action)));
      setSelected(new Set());
      setBulkConfirm(null);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process bulk action');
    }
  }

  function openQuery(id: number) {
    setQueryId(id);
    setQueryReason('');
    setModalOpen(true);
  }

  async function submitQuery() {
    if (!queryId || !queryReason.trim()) return;
    setError('');

    try {
      await performAction(queryId, 'queried', queryReason.trim());
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(queryId);
        return next;
      });
      setModalOpen(false);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send query');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-sky-600">Director approvals</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Approval Queue</h1>
            <p className="mt-1 text-sm text-slate-500">Review and action pending requests from stores and field team.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-2 text-sm font-medium text-amber-700">{pendingCount} pending</div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-medium text-emerald-700">{approvedCount} approved</div>
            <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-2 text-sm font-medium text-sky-700">{queriedCount} queried</div>
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-700">{rejectedCount} rejected</div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                >
                  <option value="">All stores</option>
                  {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="queried">Queried</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div>
              {selected.size > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3">
                  <p className="text-sm font-medium text-sky-800">
                    {selected.size} request{selected.size !== 1 ? 's' : ''} selected ·{' '}
                    <span className="font-semibold">{formatCurrency(selectedTotal)}</span>
                  </p>
                  <div className="flex gap-2">
                    {bulkConfirm === null ? (
                      <>
                        <button type="button" onClick={() => setBulkConfirm('approved')} className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approve all</button>
                        <button type="button" onClick={() => setBulkConfirm('rejected')} className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Reject all</button>
                        <button type="button" onClick={() => setSelected(new Set())} className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Clear</button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-800 self-center pr-2">Confirm {bulkConfirm} for {selected.size} items?</p>
                        <button
                          type="button"
                          onClick={() => handleBulkAction(bulkConfirm)}
                          className={`rounded-xl px-4 py-1.5 text-xs font-semibold text-white ${bulkConfirm === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                        >
                          Yes, confirm
                        </button>
                        <button type="button" onClick={() => setBulkConfirm(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allViewSelected}
                        onChange={toggleAll}
                        disabled={actionableInView.length === 0}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 accent-sky-600"
                        title="Select all actionable"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-sm text-slate-500">Loading approvals…</TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => {
                      const isActionable = request.status === 'pending' || request.status === 'queried';
                      return (
                        <TableRow key={request.id}>
                          <TableCell className={`w-10${selected.has(request.id) ? ' bg-sky-50' : ''}`}>
                            {isActionable ? (
                              <input
                                type="checkbox"
                                checked={selected.has(request.id)}
                                onChange={() => toggleOne(request.id)}
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 accent-sky-600"
                              />
                            ) : (
                              <span className="block w-4" />
                            )}
                          </TableCell>
                          <TableCell><div className="font-medium text-slate-800">{request.storeName}</div></TableCell>
                          <TableCell>
                            <div>{request.requesterName}</div>
                            {request.submitterName ? (
                              <div className="text-xs text-slate-500">{request.submitterName} · {request.submitterJobRole}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">{formatCurrency(request.amount)}</TableCell>
                          <TableCell>
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{request.category}</span>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">{new Date(request.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</TableCell>
                          <TableCell>
                            <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[request.status]}`}>{request.status}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            {isActionable ? (
                              <div className="flex flex-col gap-1.5">
                                <button type="button" onClick={() => setConfirmAction({ request, action: 'approved' })} className="w-24 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700">Approve</button>
                                <button type="button" onClick={() => setConfirmAction({ request, action: 'rejected' })} className="w-24 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700">Reject</button>
                                {request.status === 'pending' ? (
                                  <button type="button" onClick={() => openQuery(request.id)} className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">Query</button>
                                ) : null}
                                <button type="button" onClick={() => setViewRequest(request)} className="w-24 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100">View</button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs text-slate-400 capitalize">— {request.status}</span>
                                <button type="button" onClick={() => setViewRequest(request)} className="w-24 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100">View</button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </tbody>
              </Table>
              {!loading && requests.length === 0 ? <p className="pt-6 text-sm text-slate-500">No requests match the current filters.</p> : null}
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Approval guidance" description="Director approval controls and policy." className="space-y-4">
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2"><span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-sky-500" /><span><strong>Approve</strong> authorises spend against the store budget.</span></li>
                <li className="flex items-start gap-2"><span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-rose-500" /><span><strong>Reject</strong> blocks the request.</span></li>
                <li className="flex items-start gap-2"><span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-amber-500" /><span><strong>Query</strong> requests more detail from the requester.</span></li>
              </ul>
            </Card>

            <Card title="Approvals team" description="Current sign-off authority holders." className="space-y-3">
              {[
                { name: 'Alvin Galligan', role: 'Director' },
                { name: 'Nick Twomey', role: 'Director' },
                { name: "Cian O'Donoghue", role: 'Director' },
                { name: 'Anthony Kilpatrick', role: 'Head of Compliance' },
              ].map((person) => (
                <div key={person.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{person.name}</span>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{person.role}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </main>

      <Dialog
        open={!!confirmAction}
        title={confirmAction?.action === 'approved' ? 'Confirm approval' : 'Confirm rejection'}
        description={confirmAction ? `${confirmAction.action === 'approved' ? 'Approve' : 'Reject'} the ${confirmAction.request.category} request of ${formatCurrency(confirmAction.request.amount)} from ${confirmAction.request.storeName}?` : ''}
        onClose={() => setConfirmAction(null)}
      >
        {confirmAction && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
              <p><span className="font-medium">Store:</span> {confirmAction.request.storeName}</p>
              <p><span className="font-medium">Requester:</span> {confirmAction.request.requesterName}</p>
              <p><span className="font-medium">Category:</span> {confirmAction.request.category}</p>
              <p><span className="font-medium">Amount:</span> {formatCurrency(confirmAction.request.amount)}</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                type="button"
                onClick={() => handleAction(confirmAction.request.id, confirmAction.action)}
                className={confirmAction.action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
              >
                {confirmAction.action === 'approved' ? 'Yes, approve' : 'Yes, reject'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!viewRequest} title="Request details" description="Full information for this expenditure request." onClose={() => setViewRequest(null)}>
        {viewRequest && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Store</p>
                <p className="mt-0.5 font-semibold text-slate-800">{viewRequest.storeName}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Amount</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatCurrency(viewRequest.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Category</p>
                <p className="mt-0.5"><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{viewRequest.category}</span></p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                <p className="mt-0.5"><span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[viewRequest.status]}`}>{viewRequest.status}</span></p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Requester</p>
                <p className="mt-0.5 text-slate-800">{viewRequest.requesterName}</p>
              </div>
              {viewRequest.submitterName ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Submitted by</p>
                  <p className="mt-0.5 text-slate-800">{viewRequest.submitterName}</p>
                  {viewRequest.submitterJobRole ? <p className="text-xs text-slate-500">{viewRequest.submitterJobRole}</p> : null}
                </div>
              ) : <div />}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Date submitted</p>
                <p className="mt-0.5 text-slate-800">{new Date(viewRequest.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Remaining store budget</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatCurrency(viewRequest.storeRemainingBudget)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
              <p className="mt-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-700">{viewRequest.description || '—'}</p>
            </div>
            {viewRequest.receipt ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Receipt</p>
                <button
                  type="button"
                  onClick={() => openReceiptInNewTab(viewRequest.receipt!)}
                  className="mt-1 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  View / Download Receipt
                </button>
              </div>
            ) : null}
            {viewRequest.queryComment ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Query comment</p>
                <p className="mt-1 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sky-800">{viewRequest.queryComment}</p>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button variant="secondary" type="button" onClick={() => setViewRequest(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={modalOpen} title="Send query" description="Ask the requester for more details before deciding." onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <textarea
            value={queryReason}
            onChange={(e) => setQueryReason(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            placeholder="For example, please provide an alternative supplier quote."
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitQuery} disabled={!queryReason.trim()}>Send query</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
