'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { formatCurrency, readJsonSafely } from '@/lib/utils';
import { DEFAULT_PORTAL_ACCESS, PORTAL_OPTIONS, normalizePortalAccess, type PortalKey } from '@/lib/portalAccess';

type StoreRecord = { id: number; name: string; budget: number };
type FieldUser  = { id: number; name: string; email: string; title: string | null; budget: number; portalAccess: PortalKey[] };

export default function AdminPage() {
  const [stores, setStores]       = useState<StoreRecord[]>([]);
  const [fieldUsers, setFieldUsers] = useState<FieldUser[]>([]);
  const [editingBudget, setEditingBudget] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');

  // Add store
  const [addingStore, setAddingStore] = useState(false);
  const [addStoreForm, setAddStoreForm] = useState({ name: '', budget: '' });

  // Add user
  const [addingUser, setAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState<{ name: string; email: string; password: string; title: string; portalAccess: PortalKey[] }>({
    name: '',
    email: '',
    password: '',
    title: '',
    portalAccess: DEFAULT_PORTAL_ACCESS,
  });

  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [accessSavingId, setAccessSavingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'store' | 'user'; id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/stores', { cache: 'no-store' })
      .then((r) => readJsonSafely(r))
      .then((data) => { if (Array.isArray(data)) setStores(data as StoreRecord[]); })
      .catch(() => {});
    fetch('/api/users', { cache: 'no-store' })
      .then((r) => readJsonSafely(r))
      .then((data) => {
        if (Array.isArray(data)) {
          setFieldUsers(data.map((user: any) => ({
            ...user,
            portalAccess: normalizePortalAccess(user.portalAccess ?? DEFAULT_PORTAL_ACCESS),
          })) as FieldUser[]);
        }
      })
      .catch(() => {});
  }, []);

  function togglePortalAccess(current: PortalKey[], portal: PortalKey): PortalKey[] {
    const normalized = normalizePortalAccess(current);
    return normalized.includes(portal)
      ? normalized.filter((item) => item !== portal)
      : [...normalized, portal];
  }

  async function saveUserPortalAccess(userId: number, nextAccess: PortalKey[]) {
    if (nextAccess.length === 0) {
      setSaveError('Each user needs access to at least one area.');
      return;
    }

    const previous = fieldUsers.find((user) => user.id === userId)?.portalAccess ?? DEFAULT_PORTAL_ACCESS;
    setFieldUsers((prev) => prev.map((user) => user.id === userId ? { ...user, portalAccess: nextAccess } : user));
    setAccessSavingId(userId);
    setSaveError('');

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, portalAccess: nextAccess }),
      });
      if (!res.ok) {
        const payload = await readJsonSafely(res) as any;
        setFieldUsers((prev) => prev.map((user) => user.id === userId ? { ...user, portalAccess: previous } : user));
        setSaveError(payload?.error ?? 'Failed to save portal access.');
      }
    } catch {
      setFieldUsers((prev) => prev.map((user) => user.id === userId ? { ...user, portalAccess: previous } : user));
      setSaveError('Network error - portal access not saved.');
    } finally {
      setAccessSavingId(null);
    }
  }

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

  async function saveNewStore() {
    const name = addStoreForm.name.trim();
    const budget = Number(addStoreForm.budget);
    if (!name) { setAddError('Store name is required.'); return; }
    if (isNaN(budget) || budget < 0) { setAddError('Enter a valid budget.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, budget }),
      });
      const payload = await readJsonSafely(res) as any;
      if (!res.ok) { setAddError(payload?.error ?? 'Failed to create store.'); return; }
      setStores((prev) => [...prev, payload as StoreRecord].sort((a, b) => a.name.localeCompare(b.name)));
      setAddingStore(false);
      setAddStoreForm({ name: '', budget: '' });
    } catch {
      setAddError('Network error — could not create store.');
    } finally {
      setAddSaving(false);
    }
  }

  async function saveNewUser() {
    const name = addUserForm.name.trim();
    const email = addUserForm.email.trim();
    const password = addUserForm.password;
    const title = addUserForm.title.trim() || null;
    if (!name || !email || !password) { setAddError('Name, email and password are required.'); return; }
    if (addUserForm.portalAccess.length === 0) { setAddError('Select at least one portal area.'); return; }
    setAddSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, title, portalAccess: addUserForm.portalAccess }),
      });
      const payload = await readJsonSafely(res) as any;
      if (!res.ok) { setAddError(payload?.error ?? 'Failed to create user.'); return; }
      setFieldUsers((prev) => [...prev, {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        title: payload.title ?? null,
        budget: 0,
        portalAccess: normalizePortalAccess(payload.portalAccess ?? addUserForm.portalAccess),
      }].sort((a, b) => a.name.localeCompare(b.name)));
      setAddingUser(false);
      setAddUserForm({ name: '', email: '', password: '', title: '', portalAccess: DEFAULT_PORTAL_ACCESS });
    } catch {
      setAddError('Network error — could not create user.');
    } finally {
      setAddSaving(false);
    }
  }

  async function confirmDeleteItem() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const endpoint = confirmDelete.type === 'store' ? '/api/stores' : '/api/users';
      const bodyKey  = confirmDelete.type === 'store' ? 'storeId' : 'userId';
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: confirmDelete.id }),
      });
      if (!res.ok) {
        const payload = await readJsonSafely(res) as any;
        setSaveError(payload?.error ?? 'Failed to delete.');
      } else {
        if (confirmDelete.type === 'store') {
          setStores((prev) => prev.filter((s) => s.id !== confirmDelete.id));
        } else {
          setFieldUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
        }
      }
    } catch {
      setSaveError('Network error — could not delete.');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Create stores, manage field users, and choose which portal areas each user can see.</p>
        </div>

        {/* ── Budget Management ────────────────────────────────────────── */}
        <div className="mb-10 grid gap-8 lg:grid-cols-2">

          {/* Store budgets */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <span className="rounded-full bg-sky-50 px-3 py-0.5 text-xs font-semibold text-sky-700">Stores</span>
              <span className="text-sm font-semibold text-slate-800">Monthly Budgets</span>
              <span className="ml-auto text-xs text-slate-400">Budgets only</span>
              <button type="button" onClick={() => { setAddingStore(true); setAddError(''); }}
                className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 transition-colors">
                + Add Store
              </button>
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
                      <div className="flex flex-wrap items-center gap-2 gap-y-2">
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
                          className="rounded-full px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                          title="Edit budget">
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDelete({ type: 'store', id: store.id, name: store.name })}
                          className="rounded-full px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Delete store">
                          Remove
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
              {addingStore && (
                <div className="border-t border-sky-100 bg-sky-50 px-6 py-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">New Store</p>
                  {addError && <p className="text-xs text-rose-600">{addError}</p>}
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      placeholder="Store name"
                      autoFocus
                      value={addStoreForm.name}
                      onChange={(e) => setAddStoreForm((p) => ({ ...p, name: e.target.value }))}
                      className="flex-1 min-w-[140px] rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-400">€</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Monthly budget"
                        value={addStoreForm.budget}
                        onChange={(e) => setAddStoreForm((p) => ({ ...p, budget: e.target.value }))}
                        className="w-36 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveNewStore} disabled={addSaving}
                      className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                      {addSaving ? 'Saving…' : 'Create Store'}
                    </button>
                    <button type="button" onClick={() => { setAddingStore(false); setAddError(''); setAddStoreForm({ name: '', budget: '' }); }} disabled={addSaving}
                      className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Field team budgets */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">Field Team</span>
              <span className="text-sm font-semibold text-slate-800">Monthly Budgets</span>
              <span className="ml-auto text-xs text-slate-400">Budget and access</span>
              <button type="button" onClick={() => { setAddingUser(true); setAddError(''); }}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
                + Add Person
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {fieldUsers.length === 0 ? (
                <div className="px-6 py-4 text-sm text-slate-400">Loading field team…</div>
              ) : fieldUsers.map((user) => {
                const isEditing = editingBudget?.id === String(user.id);
                return (
                  <div key={user.id}>
                  <div className="flex items-center justify-between px-6 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{user.name}</p>
                      <p className="truncate text-xs text-slate-400">{user.email}</p>
                      {user.title && <p className="text-xs text-slate-400">{user.title}</p>}
                    </div>
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 gap-y-2">
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
                          className="rounded-full px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition-colors"
                          title="Edit budget">
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDelete({ type: 'user', id: user.id, name: user.name })}
                          className="rounded-full px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Remove person">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="px-6 pb-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portal access</span>
                        {accessSavingId === user.id ? <span className="text-xs text-slate-400">Saving...</span> : null}
                      </div>
                      <div className="grid gap-2">
                      {PORTAL_OPTIONS.map((option) => {
                        const checked = user.portalAccess.includes(option.key);
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => saveUserPortalAccess(user.id, togglePortalAccess(user.portalAccess, option.key))}
                            disabled={accessSavingId === user.id}
                            title={option.description}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                              checked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                            } disabled:opacity-60`}
                          >
                            <span>{option.label}</span>
                            <span className={`text-[10px] uppercase tracking-wide ${checked ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {checked ? 'On' : 'Off'}
                            </span>
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-6 py-3 bg-slate-50">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team total</span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(fieldUsers.reduce((s, u) => s + u.budget, 0))}/mo
                </span>
              </div>
              {addingUser && (
                <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">New Field Team Member</p>
                  {addError && <p className="text-xs text-rose-600">{addError}</p>}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Full name *"
                      autoFocus
                      value={addUserForm.name}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, name: e.target.value }))}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                      type="text"
                      placeholder="Job title (optional)"
                      value={addUserForm.title}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, title: e.target.value }))}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                      type="email"
                      placeholder="Email address *"
                      value={addUserForm.email}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <input
                      type="password"
                      placeholder="Temporary password * (min 8 chars)"
                      value={addUserForm.password}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, password: e.target.value }))}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Portal access</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PORTAL_OPTIONS.map((option) => {
                        const checked = addUserForm.portalAccess.includes(option.key);
                        return (
                          <label
                            key={option.key}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-2 text-sm ${
                              checked ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-emerald-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setAddUserForm((prev) => ({
                                ...prev,
                                portalAccess: togglePortalAccess(prev.portalAccess, option.key),
                              }))}
                              className="mt-1"
                            />
                            <span>
                              <span className="block font-semibold text-slate-800">{option.label}</span>
                              <span className="block text-xs text-slate-500">{option.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveNewUser} disabled={addSaving}
                      className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {addSaving ? 'Saving…' : 'Create Person'}
                    </button>
                    <button type="button" onClick={() => { setAddingUser(false); setAddError(''); setAddUserForm({ name: '', email: '', password: '', title: '', portalAccess: DEFAULT_PORTAL_ACCESS }); }} disabled={addSaving}
                      className="rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

      </main>

      {/* ── Confirm Delete Modal ──────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Remove {confirmDelete.type === 'store' ? 'Store' : 'Person'}?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to permanently remove <span className="font-semibold text-slate-700">{confirmDelete.name}</span>?
              {confirmDelete.type === 'store'
                ? ' All requests associated with this store will also be deleted.'
                : ' All requests and data for this person will also be deleted.'}
            </p>
            {saveError && <p className="mt-2 text-xs text-rose-600">{saveError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setConfirmDelete(null); setSaveError(''); }} disabled={deleting}
                className="rounded-xl border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={confirmDeleteItem} disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {deleting ? 'Removing…' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
