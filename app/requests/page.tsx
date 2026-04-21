'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import { REQUEST_CATEGORIES } from '@/lib/categories';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'queried';

type Store = {
  id: number;
  name: string;
  budget: number;
};

type RequestRecord = {
  id: number;
  storeId: number;
  storeName: string;
  requesterName: string;
  category: string;
  amount: number;
  description: string;
  receipt?: string | null;
  status: RequestStatus;
  queryComment?: string | null;
  submitterName?: string | null;
  submitterJobRole?: string | null;
  createdAt: string;
  storeRemainingBudget: number;
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queried: 'bg-sky-50 text-sky-700',
};

const CATEGORIES = [...REQUEST_CATEGORIES].sort((a, b) => a.localeCompare(b));

export default function RequestsPage() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  const [stores, setStores] = useState<Store[]>([]);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null);

  const [form, setForm] = useState({
    storeId: '',
    category: '',
    amount: '',
    description: '',
    submitterName: '',
    submitterJobRole: '',
  });

  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [fileInputKey, setFileInputKey] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Receipt editing inside the view dialog
  const [editingReceipt, setEditingReceipt] = useState(false);
  const [editReceiptDataUrl, setEditReceiptDataUrl] = useState('');
  const [editReceiptKey, setEditReceiptKey] = useState(0);
  const [savingReceipt, setSavingReceipt] = useState(false);

  function openReceiptInNewTab(receipt: string) {    const [header, data] = receipt.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete request');
      setSelectedRequest(null);
      setDeleteConfirm(false);
      if (isStoreStaff) {
        await loadRequests({ status: 'queried', storeId: form.storeId });
      } else {
        await loadRequests();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete request');
    }
  }

  async function handleSaveReceipt(id: number) {
    setSavingReceipt(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: editReceiptDataUrl || null }),
      });
      const payload = await readJsonSafely(res);
      if (!res.ok) throw new Error(getApiErrorMessage(res, payload, 'Failed to update receipt'));
      const updated = (payload as any)?.request;
      if (updated) {
        setSelectedRequest((prev) => prev ? { ...prev, receipt: updated.receipt ?? null } : prev);
        setRequests((prev) => prev.map((r) => r.id === id ? { ...r, receipt: updated.receipt ?? null } : r));
      }
      setEditingReceipt(false);
      setEditReceiptDataUrl('');
      setEditReceiptKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update receipt');
    } finally {
      setSavingReceipt(false);
    }
  }

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setReceiptDataUrl(''); return; }
    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file must be under 5 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const isStoreStaff = user?.role === 'store_staff';
  const hideStoreSelector = user?.role === 'store_staff';
  const isStoreLevelUser = isStoreStaff || user?.role === 'field_team';
  const showBudgetColumn = user?.role !== 'field_team' && user?.role !== 'director';

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  async function loadStores() {
    const response = await fetch('/api/stores', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load stores');
    const data = (await readJsonSafely(response)) as Store[] | null;
    const safeStores = (Array.isArray(data) ? data : [])
      .filter((store) => store.name.trim().toLowerCase() !== 'nutgrove');
    setStores(safeStores);
    return safeStores;
  }

  async function loadRequests(filters?: { status?: string; storeId?: string }) {
    const params = new URLSearchParams();
    const nextStatus = filters?.status ?? statusFilter;
    const nextStoreId = filters?.storeId ?? storeFilter;
    if (nextStatus) params.set('status', nextStatus);
    if (nextStoreId === 'field-team') params.set('team', 'field-team');
    else if (nextStoreId) params.set('storeId', nextStoreId);

    const url = params.toString() ? `/api/requests?${params.toString()}` : '/api/requests';
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load requests');
    const data = (await readJsonSafely(response)) as { requests?: RequestRecord[] } | null;
    setRequests(Array.isArray(data?.requests) ? data.requests : []);
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!user) return;
      setLoadingData(true);
      try {
        const allStores = await loadStores();

        if (isStoreStaff) {
          // Store accounts do not load request history; lock form to their assigned storeId.
          if (user.storeId) {
            setForm((prev) => ({ ...prev, storeId: String(user.storeId) }));
            setStoreFilter(String(user.storeId));
            await loadRequests({ status: 'queried', storeId: String(user.storeId) });
          } else if (user.store) {
            const ownStore = allStores.find((store) => store.name === user.store);
            if (ownStore) {
              setForm((prev) => ({ ...prev, storeId: String(ownStore.id) }));
              setStoreFilter(String(ownStore.id));
              await loadRequests({ status: 'queried', storeId: String(ownStore.id) });
            }
          }
        } else {
          await loadRequests();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize page');
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [user, isStoreStaff]);

  useEffect(() => {
    if (!user || isStoreStaff) return;
    loadRequests().catch(() => setError('Failed to refresh requests'));
  }, [statusFilter, storeFilter, user, isStoreStaff]);

  // Auto-open a specific request modal when ?open=ID is in the URL (e.g. clicking a notification).
  useEffect(() => {
    if (!requests.length) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('open');
    if (!openId) return;
    const found = requests.find((r) => r.id === Number(openId));
    if (found) setSelectedRequest(found);
  }, [requests]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.storeId) {
      setError('Store is not configured yet. Please contact an admin.');
      return;
    }
    if (!form.category) {
      setError('Please select a category.');
      return;
    }
    if (isStoreLevelUser && !form.submitterName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (isStoreLevelUser && !form.submitterJobRole) {
      setError('Please select your job role.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!form.description.trim()) {
      setError('Please provide a description.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: Number(form.storeId),
          category: form.category,
          amount: Number(form.amount),
          description: form.description.trim(),
          receipt: receiptDataUrl || undefined,
          submitterName: isStoreLevelUser ? form.submitterName.trim() : undefined,
          submitterJobRole: isStoreLevelUser ? form.submitterJobRole : undefined,
        }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, payload, 'Failed to submit request'));
      }

      setSuccess('Request submitted successfully and is pending approval.');
      setReceiptDataUrl('');
      setFileInputKey((k) => k + 1);
      setForm((prev) => ({
        ...prev,
        category: '',
        amount: '',
        description: '',
        submitterName: '',
        submitterJobRole: '',
        storeId: hideStoreSelector ? prev.storeId : '',
      }));
      if (isStoreStaff) {
        await loadRequests({ status: 'queried', storeId: form.storeId });
      } else {
        await loadRequests();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  function reissueFromRequest(request: RequestRecord) {
    setError('');
    setSuccess('Queried request loaded. Update details if needed, then submit to reissue.');
    setForm((prev) => ({
      ...prev,
      storeId: String(request.storeId),
      category: request.category,
      amount: String(request.amount),
      description: request.description,
      submitterName: '',
      submitterJobRole: '',
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === 'pending').length,
      approved: requests.filter((item) => item.status === 'approved').length,
      queried: requests.filter((item) => item.status === 'queried').length,
      rejected: requests.filter((item) => item.status === 'rejected').length,
    };
  }, [requests]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-widest text-sky-600">Store and field requests</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">OPEX Requests</h1>
          <p className="mt-1 text-sm text-slate-500">Submit and track operational spend requests.</p>
        </div>

        <div className={`grid gap-8 ${isStoreStaff ? '' : 'xl:grid-cols-[1.2fr_0.8fr]'}`}>
          <Card title="New OPEX Request" description="Submit a spend request for approval." className="space-y-8">
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Requester
                <input
                  type="text"
                  value={user.name}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 font-normal text-slate-500"
                />
              </label>

              {isStoreLevelUser && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Your name
                    <input
                      type="text"
                      value={form.submitterName}
                      onChange={(e) => setForm({ ...form, submitterName: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                      placeholder="Enter your name"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Job role
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                      value={form.submitterJobRole}
                      onChange={(e) => setForm({ ...form, submitterJobRole: e.target.value })}
                      required
                    >
                      <option value="">Select a role</option>
                      <option>Store Lead</option>
                      <option>Team Lead</option>
                      <option>Team Member</option>
                      <option>Field Based</option>
                    </select>
                  </label>
                </div>
              )}

              {hideStoreSelector ? (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  Category
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Store / Team
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                      value={form.storeId}
                      onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                      required
                    >
                      <option value="">Choose a location</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name === 'Field' ? 'Field Based Team' : store.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Category
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      required
                    >
                      <option value="">Select a category</option>
                      {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Amount (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-normal"
                  placeholder="0.00"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-normal"
                  placeholder="Describe the spend and business purpose."
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Receipt
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleReceiptChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal file:mr-3 file:rounded-xl file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700 hover:file:bg-sky-100"
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
              <div className="pt-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            {!isStoreStaff && (
              <>
                <Card title="Filters" description="Refine the request list." className="space-y-4">
                  <label className="block space-y-2 text-sm text-slate-700">
                    Store / Team
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      value={storeFilter}
                      onChange={(e) => setStoreFilter(e.target.value)}
                    >
                      <option value="">All locations</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name === 'Field' ? 'Field Based Team' : store.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2 text-sm text-slate-700">
                    Status
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="queried">Queried</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                </Card>

                <Card title="Summary" description="Current snapshot." className="space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-semibold text-slate-900">{summary.total}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Pending</span><span className="font-semibold text-amber-600">{summary.pending}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Approved</span><span className="font-semibold text-emerald-600">{summary.approved}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Queried</span><span className="font-semibold text-sky-600">{summary.queried}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Rejected</span><span className="font-semibold text-rose-600">{summary.rejected}</span></div>
                </Card>
              </>
            )}
          </div>
        </div>

        {!isStoreStaff ? (
          <section className="mt-8">
            <Card title="Request history" description="All requests you can access." className="space-y-4">
              {loadingData ? <p className="text-sm text-slate-500">Loading requests…</p> : null}
              
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Store</th>
                      <th className="px-4 py-3 text-left">Requester</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left"></th>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium text-slate-800">{request.storeName}</TableCell>
                        <TableCell>{request.requesterName}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{request.category}</span>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">{formatCurrency(request.amount)}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[request.status]}`}>{request.status}</span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(request.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                          >
                            View
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
                {!loadingData && requests.length === 0 ? <p className="pt-6 text-sm text-slate-500">No requests match the current filters.</p> : null}
            </Card>
          </section>
        ) : (
          <section className="mt-8">
            <Card title="Queried requests" description="Requests needing updates before resubmission." className="space-y-4">
              {loadingData ? <p className="text-sm text-slate-500">Loading queried requests…</p> : null}
              
                <Table>
                  <TableHeader>
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Amount</th>
                      <th className="px-4 py-3 text-left">Query note</th>
                      <th className="px-4 py-3 text-left"></th>
                    </tr>
                  </TableHeader>
                  <tbody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(request.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                        </TableCell>
                        <TableCell>{request.category}</TableCell>
                        <TableCell className="font-semibold text-slate-900">{formatCurrency(request.amount)}</TableCell>
                        <TableCell className="text-sm text-slate-600">{request.queryComment || 'No note provided.'}</TableCell>
                        <TableCell>
                          <Button type="button" variant="secondary" onClick={() => reissueFromRequest(request)}>
                            Reissue
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
                {!loadingData && requests.length === 0 ? <p className="pt-6 text-sm text-slate-500">No queried requests right now.</p> : null}
            </Card>
          </section>
        )}
      </main>

      {selectedRequest ? (
        <Dialog
          open
          title={`Request #${selectedRequest.id} — ${selectedRequest.storeName}`}
          description="Request details"
          onClose={() => { setSelectedRequest(null); setDeleteConfirm(false); setEditingReceipt(false); setEditReceiptDataUrl(''); }}
          className="max-w-2xl"
        >
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-1">
            <p><span className="font-medium text-slate-800">Requester:</span> {selectedRequest.requesterName}</p>
            {selectedRequest.submitterName ? (
              <p><span className="font-medium text-slate-800">Submitted by:</span> {selectedRequest.submitterName} · {selectedRequest.submitterJobRole}</p>
            ) : null}
            <p><span className="font-medium text-slate-800">Category:</span> {selectedRequest.category}</p>
            <p><span className="font-medium text-slate-800">Amount:</span> {formatCurrency(selectedRequest.amount)}</p>
            <p><span className="font-medium text-slate-800">Status:</span> {selectedRequest.status}</p>
            <p><span className="font-medium text-slate-800">Description:</span> {selectedRequest.description}</p>
            {selectedRequest.receipt ? (
              <p>
                <span className="font-medium text-slate-800">Receipt:</span>{' '}
                <button
                  type="button"
                  onClick={() => openReceiptInNewTab(selectedRequest.receipt!)}
                  className="text-sky-600 hover:underline"
                >
                  View / Download
                </button>
              </p>
            ) : null}
          </div>

          {/* Receipt upload / update */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            {!editingReceipt ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {selectedRequest.receipt ? 'Update the attached receipt.' : 'No receipt attached yet.'}
                </p>
                <button
                  type="button"
                  onClick={() => setEditingReceipt(true)}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                >
                  {selectedRequest.receipt ? 'Replace Receipt' : 'Upload Receipt'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Upload a receipt (image or PDF, max 5 MB)</p>
                <input
                  key={editReceiptKey}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) { setEditReceiptDataUrl(''); return; }
                    if (file.size > 5 * 1024 * 1024) {
                      setError('Receipt file must be under 5 MB.');
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setEditReceiptDataUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700 hover:file:bg-sky-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={savingReceipt || !editReceiptDataUrl}
                    onClick={() => handleSaveReceipt(selectedRequest.id)}
                    className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {savingReceipt ? 'Saving…' : 'Save Receipt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingReceipt(false); setEditReceiptDataUrl(''); setEditReceiptKey((k) => k + 1); }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {user?.role === 'super_admin' && (
            <div className="mt-4 flex justify-end">
              {deleteConfirm ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Delete this request?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedRequest.id)}
                    className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Delete request
                </button>
              )}
            </div>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}
