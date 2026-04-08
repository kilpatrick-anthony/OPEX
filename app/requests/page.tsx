'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { formatCurrency } from '@/lib/utils';

const storesDefault = [
  'Dublin Grafton St',
  'Cork Patrick St',
  'Galway Shop St',
  'Limerick',
  'Waterford',
  'Field Team',
];

export default function RequestsPage() {
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [form, setForm] = useState({ storeId: '', category: 'Supplies', amount: '', description: '', receipt: null as File | null });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    const auth = await fetch('/api/auth/me');
    if (!auth.ok) {
      router.push('/login');
      return;
    }

    const userData = await auth.json();
    setUser(userData.user);

    const storesRes = await fetch('/api/stores');
    setStores(await storesRes.json());
    await loadRequests(userData.user, statusFilter, storeFilter);
  }

  async function loadRequests(userData: any, status: string, storeId: string) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (storeId) params.set('storeId', storeId);

    const res = await fetch(`/api/requests?${params.toString()}`);
    const data = await res.json();
    setRequests(data.requests || []);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!form.storeId) {
      setError('Please select a store.');
      setLoading(false);
      return;
    }

    let receiptBase64 = '';
    if (form.receipt) {
      receiptBase64 = await toBase64(form.receipt);
    }

    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: Number(form.storeId),
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        receipt: receiptBase64,
      }),
    });

    setLoading(false);
    if (response.ok) {
      setSuccess('Request submitted successfully.');
      setForm({ ...form, amount: '', description: '', receipt: null });
      await loadRequests(user, statusFilter, storeFilter);
    } else {
      const body = await response.json();
      setError(body.error || 'Unable to submit request.');
    }
  }

  async function handleFilterChange() {
    await loadRequests(user, statusFilter, storeFilter);
  }

  function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const canSelectStore = user?.role !== 'employee';
  const availableStores = stores.length ? stores : storesDefault.map((name) => ({ id: 0, name }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <Card title="New OPEX Request" description="Submit a spend request for approval." className="space-y-6">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  Store
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    value={form.storeId}
                    onChange={(event) => setForm({ ...form, storeId: event.target.value })}
                    required
                  >
                    <option value="">Choose a store</option>
                    {availableStores.map((store) => (
                      <option key={store.id || store.name} value={store.id || store.name}>{store.name}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  Category
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    required
                  >
                    <option>Supplies</option>
                    <option>Marketing</option>
                    <option>Maintenance</option>
                    <option>Travel</option>
                    <option>Utilities</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-700">
                  Amount (€)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  Receipt image
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm text-slate-600"
                    onChange={(event) => setForm({ ...form, receipt: event.target.files?.[0] || null })}
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-slate-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                  required
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
              <Button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</Button>
            </form>
          </Card>

          <Card title="Filters" description="Refine your request list." className="space-y-5">
            <div className="grid gap-4">
              {user?.role !== 'employee' && (
                <label className="space-y-2 text-sm text-slate-700">
                  Store
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    value={storeFilter}
                    onChange={(event) => setStoreFilter(event.target.value)}
                  >
                    <option value="">All stores</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="space-y-2 text-sm text-slate-700">
                Status
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="queried">Queried</option>
                </select>
              </label>
              <Button variant="secondary" type="button" onClick={handleFilterChange}>Refresh</Button>
            </div>
          </Card>
        </div>

        <section className="mt-10">
          <Card title="Request queue" description="Review all requests you can access." className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Budget left</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.storeName}</TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{request.category}</TableCell>
                      <TableCell>{formatCurrency(request.amount)}</TableCell>
                      <TableCell className="capitalize text-slate-700">{request.status}</TableCell>
                      <TableCell>
                        {request.storeBudget ? (
                          <span className="text-sm text-slate-600">
                            {formatCurrency(request.storeRemainingBudget)} remaining
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
              {requests.length === 0 ? <p className="pt-6 text-sm text-slate-500">No requests found.</p> : null}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
