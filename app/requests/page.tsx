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
  status: RequestStatus;
  createdAt: string;
  storeRemainingBudget: number;
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  queried: 'bg-sky-50 text-sky-700',
};

const CATEGORIES = ['Supplies', 'Marketing', 'Maintenance', 'Travel', 'Utilities', 'Equipment'];

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
    category: 'Supplies',
    amount: '',
    description: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isStoreStaff = user?.role === 'store_staff';

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  async function loadStores() {
    const response = await fetch('/api/stores', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load stores');
    const data = (await readJsonSafely(response)) as Store[] | null;
    const safeStores = Array.isArray(data) ? data : [];
    setStores(safeStores);
    return safeStores;
  }

  async function loadRequests(filters?: { status?: string; storeId?: string }) {
    const params = new URLSearchParams();
    const nextStatus = filters?.status ?? statusFilter;
    const nextStoreId = filters?.storeId ?? storeFilter;
    if (nextStatus) params.set('status', nextStatus);
    if (nextStoreId) params.set('storeId', nextStoreId);

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

        if (isStoreStaff && user.store) {
          const ownStore = allStores.find((store) => store.name === user.store);
          if (ownStore) {
            setForm((prev) => ({ ...prev, storeId: String(ownStore.id) }));
            setStoreFilter(String(ownStore.id));
            await loadRequests({ storeId: String(ownStore.id) });
          } else {
            await loadRequests();
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
    if (!user) return;
    loadRequests().catch(() => setError('Failed to refresh requests'));
  }, [statusFilter, storeFilter]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.storeId) {
      setError('Please select a store.');
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
        }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, payload, 'Failed to submit request'));
      }

      setSuccess('Request submitted successfully and is pending approval.');
      setForm((prev) => ({
        ...prev,
        category: 'Supplies',
        amount: '',
        description: '',
        storeId: isStoreStaff ? prev.storeId : '',
      }));
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
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
          <Card title="New OPEX Request" description="Submit a spend request for approval." className="space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2 text-sm text-slate-700">
                Requester
                <input
                  type="text"
                  value={user.name}
                  disabled
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  Store / Team
                  {isStoreStaff ? (
                    <div className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 font-medium">
                      {user.store}
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      value={form.storeId}
                      onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                      required
                    >
                      <option value="">Choose a location</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  )}
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  Category
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-700">
                Amount (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  placeholder="0.00"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  placeholder="Describe the spend and business purpose."
                  required
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
              <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</Button>
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
                        <option key={store.id} value={store.id}>{store.name}</option>
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

        <section className="mt-8">
          <Card title="Request history" description="All requests you can access." className="space-y-4">
            {loadingData ? <p className="text-sm text-slate-500">Loading requests…</p> : null}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3 text-left">Store</th>
                    <th className="px-4 py-3 text-left">Requester</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Budget left</th>
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
                      <TableCell className="text-sm text-slate-600">{formatCurrency(request.storeRemainingBudget)}</TableCell>
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
            </div>
          </Card>
        </section>
      </main>

      {selectedRequest ? (
        <Dialog
          open
          title={`Request #${selectedRequest.id} — ${selectedRequest.storeName}`}
          description="Request details"
          onClose={() => setSelectedRequest(null)}
          className="max-w-2xl"
        >
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-1">
            <p><span className="font-medium text-slate-800">Requester:</span> {selectedRequest.requesterName}</p>
            <p><span className="font-medium text-slate-800">Category:</span> {selectedRequest.category}</p>
            <p><span className="font-medium text-slate-800">Amount:</span> {formatCurrency(selectedRequest.amount)}</p>
            <p><span className="font-medium text-slate-800">Status:</span> {selectedRequest.status}</p>
            <p><span className="font-medium text-slate-800">Description:</span> {selectedRequest.description}</p>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
