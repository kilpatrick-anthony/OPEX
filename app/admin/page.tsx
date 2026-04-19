'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { MOCK_USERS, ROLE_LABELS, ROLE_COLORS } from '@/lib/mockUsers';
import { formatCurrency, readJsonSafely } from '@/lib/utils';

type StoreRecord = { id: number; name: string; budget: number };
type FieldUser  = { id: number; name: string; title: string | null; budget: number };

export default function AdminPage() {
  const byRole = {
    super_admin: MOCK_USERS.filter((u) => u.role === 'super_admin'),
    director:    MOCK_USERS.filter((u) => u.role === 'director'),
    field_team:  MOCK_USERS.filter((u) => u.role === 'field_team'),
    store_staff: MOCK_USERS.filter((u) => u.role === 'store_staff'),
  } as const;

  const [stores, setStores]       = useState<StoreRecord[]>([]);
  const [fieldUsers, setFieldUsers] = useState<FieldUser[]>([]);
  const [editingBudget, setEditingBudget] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/stores', { cache: 'no-store' })
      .then((r) => readJsonSafely(r))
      .then((data) => { if (Array.isArray(data)) setStores(data as StoreRecord[]); })
      .catch(() => {});
    fetch('/api/users', { cache: 'no-store' })
      .then((r) => readJsonSafely(r))
      .then((data) => { if (Array.isArray(data)) setFieldUsers(data as FieldUser[]); })
      .catch(() => {});
  }, []);

  function startEdit(id: string, current: number) {
    setEditingBudget({ id, value: String(current) });
    setSaveError('');
  }

  async function saveBudget(isStore: boolean) {
    if (!editingBudget) return;
    const val = Number(editingBudget.value);
    if (isNaN(val) || val < 0) { setEditingBudget(null); return; }

    if (isStore) {
      setSaving(true);
      setSaveError('');
      try {
        const res = await fetch('/api/stores', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: Number(editingBudget.id), budget: val }),
        });
        if (!res.ok) {
          const payload = await readJsonSafely(res) as any;
          setSaveError(payload?.error ?? 'Failed to save budget.');
        } else {
          setStores((prev) => prev.map((s) => s.id === Number(editingBudget.id) ? { ...s, budget: val } : s));
        }
      } catch {
        setSaveError('Network error — budget not saved.');
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      setSaveError('');
      try {
        const res = await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: Number(editingBudget.id), budget: val }),
        });
        if (!res.ok) {
          const payload = await readJsonSafely(res) as any;
          setSaveError(payload?.error ?? 'Failed to save budget.');
        } else {
          setFieldUsers((prev) => prev.map((u) => u.id === Number(editingBudget.id) ? { ...u, budget: val } : u));
        }
      } catch {
        setSaveError('Network error — budget not saved.');
      } finally {
        setSaving(false);
      }
    }

    setEditingBudget(null);
  }

  function cancelEdit() { setEditingBudget(null); setSaveError(''); }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="mt-1 text-sm text-slate-500">User overview and budget management</p>
        </div>

        {/* ── Budget Management ────────────────────────────────────────── */}
        <div className="mb-10 grid gap-8 lg:grid-cols-2">

          {/* Store budgets */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <span className="rounded-full bg-sky-50 px-3 py-0.5 text-xs font-semibold text-sky-700">Stores</span>
              <span className="text-sm font-semibold text-slate-800">Monthly Budgets</span>
              <span className="ml-auto text-xs text-slate-400">Click pencil to edit</span>
            </div>
            {saveError && (
              <div className="bg-rose-50 px-6 py-2 text-xs font-medium text-rose-600">{saveError}</div>
            )}
            <div className="divide-y divide-slate-50">
              {stores.length === 0 ? (
                <div className="px-6 py-4 text-sm text-slate-400">Loading stores…</div>
              ) : stores.map((store) => {
                const isEditing = editingBudget?.id === String(store.id);
                return (
                  <div key={store.id} className="flex items-center justify-between px-6 py-3 gap-3">
                    <span className="text-sm font-medium text-slate-800">{store.name}</span>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">€</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          autoFocus
                          value={editingBudget.value}
                          onChange={(e) => setEditingBudget((p) => p ? { ...p, value: e.target.value } : null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(true); if (e.key === 'Escape') cancelEdit(); }}
                          className="w-28 rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                        <button type="button" onClick={() => saveBudget(true)} disabled={saving}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={saving}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(store.budget)}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        <button type="button" onClick={() => startEdit(String(store.id), store.budget)}
                          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                          title="Edit budget">
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-6 py-3 bg-slate-50">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Network total</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(stores.reduce((s, v) => s + v.budget, 0))}/mo
                </span>
              </div>
            </div>
          </Card>

          {/* Field team budgets */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">Field Team</span>
              <span className="text-sm font-semibold text-slate-800">Monthly Budgets</span>
              <span className="ml-auto text-xs text-slate-400">Click pencil to edit</span>
            </div>
            <div className="divide-y divide-slate-50">
              {fieldUsers.length === 0 ? (
                <div className="px-6 py-4 text-sm text-slate-400">Loading field team…</div>
              ) : fieldUsers.map((user) => {
                const isEditing = editingBudget?.id === String(user.id);
                return (
                  <div key={user.id} className="flex items-center justify-between px-6 py-3 gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{user.name}</p>
                      {user.title && <p className="text-xs text-slate-400">{user.title}</p>}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">€</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          autoFocus
                          value={editingBudget.value}
                          onChange={(e) => setEditingBudget((p) => p ? { ...p, value: e.target.value } : null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(false); if (e.key === 'Escape') cancelEdit(); }}
                          className="w-28 rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                        <button type="button" onClick={() => saveBudget(false)} disabled={saving}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={saving}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(user.budget)}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        <button type="button" onClick={() => startEdit(String(user.id), user.budget)}
                          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                          title="Edit budget">
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-6 py-3 bg-slate-50">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team total</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(fieldUsers.reduce((s, u) => s + u.budget, 0))}/mo
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Users ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <p className="mt-0.5 text-sm text-slate-500">All mock accounts in the system</p>
        </div>

        <div className="grid gap-6">
          {(Object.keys(byRole) as (keyof typeof byRole)[]).map((role) => (
            <Card key={role} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-sm text-slate-400">{byRole[role].length} user{byRole[role].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {byRole[role].map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                      <span className="text-sm font-medium text-slate-800">{u.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {u.store && <span>Store: <span className="text-slate-600">{u.store}</span></span>}
                      {u.employeeSlug && <span>Slug: <span className="font-mono text-slate-600">{u.employeeSlug}</span></span>}
                      {/* Show current budget for store_staff / field_team */}
                      {u.store && (() => { const s = stores.find((st) => st.name === u.store); return s ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {formatCurrency(s.budget)}/mo
                        </span>
                      ) : null; })()}
                      {u.employeeSlug && (() => { const fu = fieldUsers.find((f) => f.name === u.name); return fu ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {formatCurrency(fu.budget)}/mo
                        </span>
                      ) : null; })()}
                      <span className="font-mono text-slate-300">{u.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
