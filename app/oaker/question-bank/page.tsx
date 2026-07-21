'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OakerNavbar } from '@/components/OakerNavbar';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import { OAKER_EXPRESS_QUESTION_COUNT, OAKER_SECTIONS, type OakerQuestion } from '@/lib/oaker';

type QuestionRecord = OakerQuestion & {
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type QuestionPayload = {
  questions?: QuestionRecord[];
  question?: QuestionRecord;
  canManage?: boolean;
};

type QuestionForm = {
  id?: number;
  section: OakerQuestion['section'];
  standard: string;
  weighting: string;
  active: boolean;
  expressPinned: boolean;
};

const EMPTY_FORM: QuestionForm = {
  section: 'Operations',
  standard: '',
  weighting: '6',
  active: true,
  expressPinned: false,
};

const QUESTION_TABLE_COLUMNS =
  'xl:grid-cols-[64px_132px_minmax(280px,1fr)_72px_124px_108px_188px]';

const SECTION_TILE_STYLES: Record<
  OakerQuestion['section'],
  { card: string; selected: string; accent: string; label: string; value: string; meta: string }
> = {
  Operations: {
    card: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50',
    selected: 'ring-2 ring-emerald-300',
    accent: 'bg-emerald-500',
    label: 'text-emerald-800',
    value: 'text-emerald-950',
    meta: 'text-emerald-700',
  },
  'Customer Service': {
    card: 'border-sky-200 bg-sky-50/70 hover:border-sky-300 hover:bg-sky-50',
    selected: 'ring-2 ring-sky-300',
    accent: 'bg-sky-500',
    label: 'text-sky-800',
    value: 'text-sky-950',
    meta: 'text-sky-700',
  },
  Systems: {
    card: 'border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50',
    selected: 'ring-2 ring-amber-300',
    accent: 'bg-amber-500',
    label: 'text-amber-800',
    value: 'text-amber-950',
    meta: 'text-amber-700',
  },
  'Health & Safety': {
    card: 'border-rose-200 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50',
    selected: 'ring-2 ring-rose-300',
    accent: 'bg-rose-500',
    label: 'text-rose-800',
    value: 'text-rose-950',
    meta: 'text-rose-700',
  },
};

function formatDate(dateText?: string) {
  if (!dateText) return 'Not saved yet';
  return new Date(dateText).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toForm(question: QuestionRecord): QuestionForm {
  return {
    id: question.id,
    section: question.section,
    standard: question.standard,
    weighting: String(question.weighting),
    active: question.active,
    expressPinned: Boolean(question.expressPinned),
  };
}

export default function OakerQuestionBankPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [sectionFilter, setSectionFilter] = useState<'all' | OakerQuestion['section']>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');
  const [editing, setEditing] = useState<QuestionForm | null>(null);
  const [draft, setDraft] = useState<QuestionForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeQuestions = questions.filter((question) => question.active);

  async function loadQuestions() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/oaker/questions', { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as QuestionPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load question bank'));
      setQuestions(Array.isArray(payload?.questions) ? payload.questions : []);
      setCanManage(Boolean(payload?.canManage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question bank');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    loadQuestions();
  }, [user, userLoading, router]);

  const sectionSummary = useMemo(() => {
    return OAKER_SECTIONS.map((section) => {
      const items = activeQuestions.filter((question) => question.section === section);
      const weighting = items.reduce((sum, question) => sum + question.weighting, 0);
      return { section, count: items.length, weighting };
    });
  }, [activeQuestions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      const sectionMatches = sectionFilter === 'all' || question.section === sectionFilter;
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'active' && question.active) ||
        (statusFilter === 'inactive' && !question.active);
      return sectionMatches && statusMatches;
    });
  }, [questions, sectionFilter, statusFilter]);

  const highestWeightedQuestions = useMemo(() => {
    return activeQuestions
      .slice()
      .sort((a, b) => b.weighting - a.weighting || a.section.localeCompare(b.section) || a.id - b.id)
      .slice(0, OAKER_EXPRESS_QUESTION_COUNT);
  }, [activeQuestions]);

  const expressPinnedQuestions = useMemo(() => {
    return activeQuestions
      .filter((question) => question.expressPinned)
      .sort((a, b) => b.weighting - a.weighting || a.id - b.id);
  }, [activeQuestions]);

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      id: draft.id,
      section: draft.section,
      standard: draft.standard,
      weighting: Number(draft.weighting),
      active: draft.active,
      expressPinned: draft.expressPinned,
    };

    try {
      const response = await fetch('/api/oaker/questions', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await readJsonSafely(response)) as QuestionPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, result, 'Failed to save question'));
      await loadQuestions();
      setDraft(EMPTY_FORM);
      setEditing(null);
      setSuccess(draft.id ? 'Question updated.' : 'Question added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setSaving(false);
    }
  }

  async function setQuestionActive(question: QuestionRecord, active: boolean) {
    if (!canManage) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/oaker/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...question, active }),
      });
      const result = (await readJsonSafely(response)) as QuestionPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, result, 'Failed to update question'));
      await loadQuestions();
      setSuccess(active ? 'Question reactivated.' : 'Question archived.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update question');
    } finally {
      setSaving(false);
    }
  }

  async function setQuestionExpressPinned(question: QuestionRecord, expressPinned: boolean) {
    if (!canManage) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/oaker/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...question, expressPinned }),
      });
      const result = (await readJsonSafely(response)) as QuestionPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, result, 'Failed to update Express list'));
      await loadQuestions();
      setSuccess(expressPinned ? 'Question pinned for OAKER Express.' : 'Question removed from Express pinned list.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Express list');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(question: QuestionRecord) {
    setEditing(toForm(question));
    setDraft(toForm(question));
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY_FORM);
    setSuccess('');
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <OakerNavbar />
        <main className="container py-10 text-sm text-slate-500">Loading question bank...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container py-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-emerald-600">OAKER Experience</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Question Bank</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Active questions feed future OAKER Experience and OAKER Express checks. Submitted checks keep their original wording and weighting.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-500">Active bank</p>
            <p className="text-2xl font-semibold text-slate-900">{activeQuestions.length}</p>
          </div>
        </div>

        {error ? <p className="mt-6 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sectionSummary.map((item) => {
            const tileStyle = SECTION_TILE_STYLES[item.section];
            const isSelected = sectionFilter === item.section;
            return (
              <button
                type="button"
                key={item.section}
                onClick={() => setSectionFilter(item.section)}
                className={`relative overflow-hidden rounded-lg border p-4 text-left shadow-sm transition ${tileStyle.card} ${isSelected ? tileStyle.selected : ''}`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${tileStyle.accent}`} />
                <p className={`text-sm font-semibold ${tileStyle.label}`}>{item.section}</p>
                <p className={`mt-2 text-2xl font-semibold ${tileStyle.value}`}>{item.count}</p>
                <p className={`mt-1 text-xs font-medium ${tileStyle.meta}`}>{item.weighting} total weighting</p>
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card title={editing ? `Edit Question ${editing.id}` : 'Add Question'} description={canManage ? 'Changes apply to new checks only.' : 'You can view the live bank, but only directors and super admins can edit it.'}>
            <form onSubmit={saveQuestion} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Section
                <select
                  value={draft.section}
                  disabled={!canManage || saving}
                  onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value as OakerQuestion['section'] }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal"
                >
                  {OAKER_SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Weighting
                <input
                  type="number"
                  min="1"
                  max="25"
                  step="0.5"
                  value={draft.weighting}
                  disabled={!canManage || saving}
                  onChange={(event) => setDraft((current) => ({ ...current, weighting: event.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Question
                <textarea
                  value={draft.standard}
                  disabled={!canManage || saving}
                  onChange={(event) => setDraft((current) => ({ ...current, standard: event.target.value }))}
                  rows={5}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={!canManage || saving}
                  onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active for future checks
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.expressPinned}
                  disabled={!canManage || saving}
                  onChange={(event) => setDraft((current) => ({ ...current, expressPinned: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Always include in OAKER Express
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!canManage || saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Question'}</Button>
                {editing ? <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>Cancel</Button> : null}
              </div>
            </form>
          </Card>

          <Card title="Filters" description={`${filteredQuestions.length} questions shown`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Section
                <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value as typeof sectionFilter)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal">
                  <option value="all">All sections</option>
                  {OAKER_SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal">
                  <option value="active">Active</option>
                  <option value="all">All</option>
                  <option value="inactive">Archived</option>
                </select>
              </label>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Full OAKER Experience uses every active question. OAKER Express selects a smaller set from the same active bank using weighting and failure history.
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <Card title="OAKER Express Priority" description="Pinned questions are always considered first for Express checks. The remaining Express questions still come from weighting, failure history, and rotation.">
            <div className="space-y-3">
              {expressPinnedQuestions.length ? expressPinnedQuestions.map((question) => (
                <div key={question.id} className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">#{question.id} · {question.section}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-slate-900">{question.standard}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-700">{question.weighting}</span>
                  </div>
                  <Button type="button" variant="ghost" className="mt-2 px-2 py-1 text-xs" onClick={() => setQuestionExpressPinned(question, false)} disabled={!canManage || saving}>
                    Remove from Express priority
                  </Button>
                </div>
              )) : (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">No questions are pinned yet. Express is currently using weighting, failure history, and rotation only.</p>
              )}
            </div>
          </Card>

          <Card title="Highest Weighted Active Questions" description="Use this as the shortlist for deciding what should be pinned into OAKER Express.">
            <div className="space-y-3">
              {highestWeightedQuestions.map((question) => (
                <div key={question.id} className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">#{question.id} · {question.section} · Weight {question.weighting}</p>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-900">{question.standard}</p>
                  </div>
                  <Button type="button" variant={question.expressPinned ? 'secondary' : 'ghost'} className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setQuestionExpressPinned(question, !question.expressPinned)} disabled={!canManage || saving}>
                    {question.expressPinned ? 'Pinned' : 'Pin'}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className={`grid ${QUESTION_TABLE_COLUMNS} gap-x-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 max-xl:hidden`}>
            <span>ID</span>
            <span>Section</span>
            <span>Question</span>
            <span className="text-center">Weight</span>
            <span>Status</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((question) => (
              <div key={question.id} className={`grid gap-3 px-4 py-4 text-sm xl:gap-x-4 ${QUESTION_TABLE_COLUMNS} xl:items-start`}>
                <div className="font-semibold text-slate-900">#{question.id}</div>
                <div className="min-w-0 break-words text-slate-700">{question.section}</div>
                <div className="min-w-0">
                  <p className="break-words leading-6 text-slate-900">{question.standard}</p>
                  <div className="mt-3 flex flex-wrap gap-2 xl:hidden">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Weight {question.weighting}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${question.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {question.active ? 'Active' : 'Archived'}
                    </span>
                    {question.expressPinned ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Express</span> : null}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{formatDate(question.updatedAt)}</span>
                  </div>
                </div>
                <div className="hidden text-center font-semibold text-slate-900 xl:block">{question.weighting}</div>
                <div className="hidden xl:block">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${question.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {question.active ? 'Active' : 'Archived'}
                    </span>
                    {question.expressPinned ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">Express</span> : null}
                  </div>
                </div>
                <div className="hidden whitespace-nowrap text-slate-500 xl:block">{formatDate(question.updatedAt)}</div>
                <div className="flex flex-wrap gap-2 xl:flex-nowrap xl:justify-end">
                  <Button type="button" variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => startEdit(question)} disabled={!canManage || saving}>Edit</Button>
                  <Button type="button" variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setQuestionExpressPinned(question, !question.expressPinned)} disabled={!canManage || saving || !question.active}>
                    {question.expressPinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button type="button" variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setQuestionActive(question, !question.active)} disabled={!canManage || saving}>
                    {question.active ? 'Archive' : 'Reactivate'}
                  </Button>
                </div>
              </div>
            ))}
            {filteredQuestions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500">No questions match these filters.</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
