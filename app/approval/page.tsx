'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Navbar } from '@/components/Navbar';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Queried', value: 'queried' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function ApprovalPage() {
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [queryId, setQueryId] = useState<number | null>(null);
  const [queryReason, setQueryReason] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
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
    if (userData.user.role !== 'director') {
      router.push('/requests');
      return;
    }

    const storesRes = await fetch('/api/stores');
    setStores(await storesRes.json());
    await loadRequests(statusFilter, storeFilter);
  }

  async function loadRequests(status: string, storeId: string) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (storeId) params.set('storeId', storeId);
    const res = await fetch(`/api/requests?${params.toString()}`);
    const data = await res.json();
    setRequests(data.requests || []);
  }

  async function handleAction(requestId: number, action: 'approved' | 'rejected') {
    setLoading(true);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setLoading(false);
    if (res.ok) {
      await loadRequests(statusFilter, storeFilter);
    } else {
      const body = await res.json();
      setError(body.error || 'Action failed.');
    }
  }

  function openQuery(requestId: number) {
    setQueryId(requestId);
    setQueryReason('');
    setModalOpen(true);
  }

  async function submitQuery() {
    if (!queryId) return;
    setLoading(true);
    const res = await fetch(`/api/requests/${queryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'queried', comment: queryReason }),
    });
    setLoading(false);
    setModalOpen(false);
    if (res.ok) {
      await loadRequests(statusFilter, storeFilter);
    } else {
      const body = await res.json();
      setError(body.error || 'Query failed.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <Card title="Approval queue" description="Review and approve or query pending OPEX requests." className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  value={storeFilter}
                  onChange={(event) => setStoreFilter(event.target.value)}
                >
                  <option value="">All stores</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  value={statusFilter}
                  onChange={async (event) => {
                    setStatusFilter(event.target.value);
                    await loadRequests(event.target.value, storeFilter);
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" type="button" onClick={() => loadRequests(statusFilter, storeFilter)}>
                Refresh
              </Button>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Budget remaining</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </TableHeader>
                <tbody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.storeName}</TableCell>
                      <TableCell>{request.requesterName}</TableCell>
                      <TableCell>{formatCurrency(request.amount)}</TableCell>
                      <TableCell>{request.category}</TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {request.storeRemainingBudget ? formatCurrency(request.storeRemainingBudget) : '—'} remaining
                        </span>
                      </TableCell>
                      <TableCell className="space-x-2 py-4">
                        <Button variant="default" type="button" onClick={() => handleAction(request.id, 'approved')} disabled={loading}>
                          Approve
                        </Button>
                        <Button variant="danger" type="button" onClick={() => handleAction(request.id, 'rejected')} disabled={loading}>
                          Reject
                        </Button>
                        <Button variant="secondary" type="button" onClick={() => openQuery(request.id)} disabled={loading}>
                          Query
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
              {requests.length === 0 ? <p className="pt-6 text-sm text-slate-500">No matching requests found.</p> : null}
            </div>
          </Card>

          <Card title="Approval guidance" description="Director approval controls and status checks.">
            <p className="text-sm text-slate-600">Use the query action to ask for more details before approving. Approved expenses will count against the store budget in the dashboard.</p>
          </Card>
        </div>
      </main>

      <Dialog open={modalOpen} title="Send query" description="Ask the requester for more details." onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <textarea
            value={queryReason}
            onChange={(event) => setQueryReason(event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            placeholder="Add a short reason or question for the requester"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitQuery} disabled={loading || !queryReason.trim()}>
              Send query
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
