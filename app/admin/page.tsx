'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { MOCK_USERS, ROLE_LABELS, ROLE_COLORS } from '@/lib/mockUsers';
import { STORE_DETAILS, EMPLOYEE_DETAILS } from '@/lib/mockData';
import { formatCurrency } from '@/lib/utils';

// Build initial budgets from mockData
const INITIAL_STORE_BUDGETS = Object.fromEntries(
  Object.entries(STORE_DETAILS).map(([slug, d]) => [slug, d.monthlyBudget])
);
const INITIAL_EMP_BUDGETS = Object.fromEntries(
  Object.entries(EMPLOYEE_DETAILS).map(([slug, d]) => [slug, d.monthlyBudget])
);

export default function AdminPage() {
  const byRole = {
    super_admin: MOCK_USERS.filter((u) => u.role === 'super_admin'),
    director:    MOCK_USERS.filter((u) => u.role === 'director'),
    field_team:  MOCK_USERS.filter((u) => u.role === 'field_team'),
    store_staff: MOCK_USERS.filter((u) => u.role === 'store_staff'),
  } as const;

  const [storeBudgets, setStoreBudgets] = useState<Record<string, number>>(INITIAL_STORE_BUDGETS);
  const [empBudgets,   setEmpBudgets]   = useState<Record<string, number>>(INITIAL_EMP_BUDGETS);

  // Inline editing state: { slug, value }
  const [editingBudget, setEditingBudget] = useState<{ slug: string; value: string } | null>(null);

  function startEdit(slug: string, current: number) {
    setEditingBudget({ slug, value: String(current) });
  }

  function saveBudget(isStore: boolean) {
    if (!editingBudget) return;
    const val = Number(editingBudget.value);
    if (!isNaN(val) && val >= 0) {
      if (isStore) setStoreBudgets((prev) => ({ ...prev, [editingBudget.slug]: val }));
      else         setEmpBudgets(  (prev) => ({ ...prev, [editingBudget.slug]: val }));
    }
    setEditingBudget(null);
  }

  function cancelEdit() { setEditingBudget(null); }

  // slug → name mapping for stores
  function storeSlugToName(slug: string) {
    return STORE_DETAILS[slug]?.name ?? slug;
  }

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
            <div className="divide-y divide-slate-50">
              {Object.entries(storeBudgets).map(([slug, budget]) => {
                const isEditing = editingBudget?.slug === slug;
                return (
                  <div key={slug} className="flex items-center justify-between px-6 py-3 gap-3">
                    <span className="text-sm font-medium text-slate-800">{storeSlugToName(slug)}</span>
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
                        <button type="button" onClick={() => saveBudget(true)}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(budget)}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        <button type="button" onClick={() => startEdit(slug, budget)}
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
                  {formatCurrency(Object.values(storeBudgets).reduce((s, v) => s + v, 0))}/mo
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
              {Object.entries(empBudgets).map(([slug, budget]) => {
                const isEditing = editingBudget?.slug === slug;
                const emp = EMPLOYEE_DETAILS[slug];
                return (
                  <div key={slug} className="flex items-center justify-between px-6 py-3 gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{emp?.name ?? slug}</p>
                      {emp?.role && <p className="text-xs text-slate-400">{emp.role}</p>}
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
                        <button type="button" onClick={() => saveBudget(false)}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(budget)}</span>
                        <span className="text-xs text-slate-400">/mo</span>
                        <button type="button" onClick={() => startEdit(slug, budget)}
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
                  {formatCurrency(Object.values(empBudgets).reduce((s, v) => s + v, 0))}/mo
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
                      {u.store && storeBudgets[u.store.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')] !== undefined && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                          {formatCurrency(storeBudgets[u.store.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')]  )}/mo
                        </span>
                      )}
                      {u.employeeSlug && empBudgets[u.employeeSlug] !== undefined && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {formatCurrency(empBudgets[u.employeeSlug])}/mo
                        </span>
                      )}
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
