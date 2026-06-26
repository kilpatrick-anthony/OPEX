'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { OakerNavbar } from '@/components/OakerNavbar';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';
import { useCurrentUser } from '@/lib/userContext';
import type { OakerAnswer, OakerMode, OakerQuestion } from '@/lib/oaker';

type Store = {
  id: number;
  name: string;
};

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
};

type InspectionResponse = {
  id: number;
  inspectionId: number;
  questionId: number;
  section: string;
  standard: string;
  weighting: number;
  answer: OakerAnswer;
  comments: string | null;
  photos: string[];
};

type InspectionDetail = Inspection & {
  notes: string | null;
  reportPath?: string | null;
  reportText?: string | null;
  responses: InspectionResponse[];
};

type ResponseState = {
  answer: OakerAnswer | '';
  comments: string;
  photos: string[];
};

type CheckDraft = {
  storeId: string;
  mode: OakerMode;
  currentIndex: number;
  responses: Record<number, Omit<ResponseState, 'photos'> & { photos?: string[] }>;
  notes: string;
  updatedAt: string;
};

type OakerPayload = {
  stores?: Store[];
  inspections?: Inspection[];
  latestByStore?: Inspection[];
  template?: {
    mode: OakerMode;
    questions: OakerQuestion[];
    fullQuestionCount: number;
    expressDescription: string;
  };
};

const ANSWER_LABELS: Record<OakerAnswer, string> = {
  yes: 'Yes',
  no: 'No',
  capex: 'Capex',
};

const ANSWER_STYLES: Record<OakerAnswer, string> = {
  yes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  no: 'border-rose-200 bg-rose-50 text-rose-700',
  capex: 'border-amber-200 bg-amber-50 text-amber-700',
};

const RATING_STYLES: Record<string, string> = {
  Green: 'bg-emerald-50 text-emerald-700',
  Amber: 'bg-amber-50 text-amber-700',
  Red: 'bg-rose-50 text-rose-700',
};

const DRAFT_KEY = 'oaker-check-draft-v1';
const EMPTY_RESPONSE: ResponseState = { answer: '', comments: '', photos: [] };
const MAX_PHOTO_SIZE_MB = 10;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

function formatScore(inspection: Inspection) {
  return `${inspection.percentage.toFixed(1)}%`;
}

function readFiles(files: File[]) {
  return Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  })));
}

function createDraftResponses(responses: Record<number, ResponseState>): CheckDraft['responses'] {
  return Object.fromEntries(
    Object.entries(responses).map(([questionId, response]) => [
      questionId,
      { answer: response.answer, comments: response.comments },
    ]),
  );
}

function hydrateDraftResponses(responses: CheckDraft['responses']): Record<number, ResponseState> {
  return Object.fromEntries(
    Object.entries(responses).map(([questionId, response]) => [
      questionId,
      { answer: response.answer, comments: response.comments, photos: [] },
    ]),
  );
}

export default function OakerPage() {
  const router = useRouter();
  const pageTitleRef = useRef<HTMLDivElement | null>(null);
  const activeQuestionRef = useRef<HTMLDivElement | null>(null);
  const { user, isLoading } = useCurrentUser();
  const [stores, setStores] = useState<Store[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [latestByStore, setLatestByStore] = useState<Inspection[]>([]);
  const [questions, setQuestions] = useState<OakerQuestion[]>([]);
  const [expressDescription, setExpressDescription] = useState('');
  const [mode, setMode] = useState<OakerMode>('express');
  const [storeId, setStoreId] = useState('');
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, ResponseState>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<InspectionDetail | null>(null);
  const [draft, setDraft] = useState<CheckDraft | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isReportStep = questions.length > 0 && currentIndex >= questions.length;
  const currentQuestion = questions[currentIndex];
  const currentResponse = currentQuestion ? responses[currentQuestion.id] ?? EMPTY_RESPONSE : null;
  const completedCount = questions.filter((question) => responses[question.id]?.answer).length;

  const selectedStoreName = stores.find((store) => String(store.id) === storeId)?.name ?? '';
  const canChooseStore = user?.role === 'director' || user?.role === 'super_admin';

  const sectionJumpLinks = useMemo(() => {
    const seen = new Set<string>();
    return questions.reduce<Array<{ section: string; index: number; done: number; total: number }>>((links, question, index) => {
      if (seen.has(question.section)) return links;
      seen.add(question.section);
      const sectionQuestions = questions.filter((item) => item.section === question.section);
      links.push({
        section: question.section,
        index,
        done: sectionQuestions.filter((item) => responses[item.id]?.answer).length,
        total: sectionQuestions.length,
      });
      return links;
    }, []);
  }, [questions, responses]);

  const reportSections = useMemo(() => {
    if (!selectedReport) return [];
    const sections = selectedReport.responses.reduce<Record<string, { score: number; maxScore: number; failed: number; capex: number; responses: InspectionResponse[] }>>((acc, response) => {
      if (!acc[response.section]) acc[response.section] = { score: 0, maxScore: 0, failed: 0, capex: 0, responses: [] };
      acc[response.section].maxScore += response.weighting;
      if (response.answer === 'yes') acc[response.section].score += response.weighting;
      if (response.answer === 'no') acc[response.section].failed += 1;
      if (response.answer === 'capex') acc[response.section].capex += 1;
      acc[response.section].responses.push(response);
      return acc;
    }, {});

    return Object.entries(sections).map(([section, summary]) => ({
      section,
      ...summary,
      percentage: summary.maxScore > 0 ? Math.round((summary.score / summary.maxScore) * 1000) / 10 : 0,
    }));
  }, [selectedReport]);

  const failedReportResponses = selectedReport?.responses.filter((response) => response.answer !== 'yes') ?? [];
  const reportPhotoCount = selectedReport?.responses.reduce((sum, response) => sum + response.photos.length, 0) ?? 0;

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CheckDraft;
      if (parsed?.storeId && parsed?.mode && parsed?.responses) setDraft(parsed);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  async function loadOaker(nextMode = mode, nextStoreId = storeId) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('mode', nextMode);
      if (nextStoreId) params.set('storeId', nextStoreId);
      const response = await fetch(`/api/oaker?${params.toString()}`, { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as OakerPayload | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load OAKER data'));
      const nextQuestions = Array.isArray(payload?.template?.questions) ? payload.template.questions : [];
      setStores(Array.isArray(payload?.stores) ? payload.stores : []);
      setInspections(Array.isArray(payload?.inspections) ? payload.inspections : []);
      setLatestByStore(Array.isArray(payload?.latestByStore) ? payload.latestByStore : []);
      setQuestions(nextQuestions);
      setExpressDescription(payload?.template?.expressDescription ?? '');
      if (!nextStoreId && payload?.stores?.length === 1) setStoreId(String(payload.stores[0].id));
      return nextQuestions;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAKER data');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadOaker().catch(() => setError('Failed to load OAKER data'));
  }, [user]);

  useEffect(() => {
    if (!user || active) return;
    loadOaker(mode, storeId).catch(() => setError('Failed to refresh OAKER template'));
  }, [mode, storeId]);

  function scrollToPageTitle(behavior: ScrollBehavior = 'smooth') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        pageTitleRef.current?.scrollIntoView({ block: 'start', behavior });
      });
    });
  }

  useEffect(() => {
    if (!active) return;
    window.requestAnimationFrame(() => {
      pageTitleRef.current?.scrollIntoView({ block: 'start' });
    });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    window.requestAnimationFrame(() => {
      activeQuestionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [active, currentIndex]);

  useEffect(() => {
    if (!active || !storeId || questions.length === 0) return;
    const nextDraft: CheckDraft = {
      storeId,
      mode,
      currentIndex,
      responses: createDraftResponses(responses),
      notes,
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(nextDraft));
      setDraft(nextDraft);
    } catch {
      setError('This check is too large to save in this browser. Please submit before leaving the page.');
    }
  }, [active, storeId, mode, currentIndex, responses, notes, questions.length]);

  function updateResponse(questionId: number, patch: Partial<ResponseState>) {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { answer: '', comments: '', photos: [] }),
        ...patch,
      },
    }));
  }

  async function handlePhotoChange(questionId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.some((file) => file.size > MAX_PHOTO_SIZE_BYTES)) {
      setError(`Each photo must be under ${MAX_PHOTO_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }

    try {
      const dataUrls = await readFiles(files);
      updateResponse(questionId, {
        photos: [...(responses[questionId]?.photos ?? []), ...dataUrls],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read photos');
    }
  }

  async function startCheck(nextMode = mode) {
    if (!storeId) {
      setError('Please choose a store first.');
      return;
    }
    setError('');
    setSuccess('');
    setMode(nextMode);
    const nextQuestions = nextMode === mode && questions.length > 0 ? questions : await loadOaker(nextMode, storeId);
    if (nextQuestions.length === 0) {
      setError('No questions are available for this check.');
      return;
    }
    setResponses({});
    setNotes('');
    setCurrentIndex(0);
    setActive(true);
  }

  async function resumeDraft() {
    if (!draft) return;
    setError('');
    setSuccess('');
    setStoreId(draft.storeId);
    setMode(draft.mode);
    const draftQuestions = await loadOaker(draft.mode, draft.storeId);
    if (draftQuestions.length === 0) {
      setError('Could not resume this saved check because the questions are no longer available.');
      return;
    }
    setResponses(hydrateDraftResponses(draft.responses ?? {}));
    setNotes(draft.notes ?? '');
    setCurrentIndex(Math.min(Math.max(draft.currentIndex ?? 0, 0), draftQuestions.length));
    setActive(true);
  }

  function discardDraft() {
    window.localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
  }

  async function submitCheck() {
    setError('');
    setSuccess('');
    if (completedCount !== questions.length) {
      setError('Please answer every question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/oaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          storeId: Number(storeId),
          notes,
          responses: questions.map((question) => ({
            questionId: question.id,
            answer: responses[question.id].answer,
            comments: responses[question.id].comments,
            photos: responses[question.id].photos,
          })),
        }),
      });
      const payload = await readJsonSafely(response);
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to submit OAKER check'));
      setSuccess('OAKER check submitted successfully.');
      setActive(false);
      setResponses({});
      setNotes('');
      discardDraft();
      await loadOaker(mode, storeId);
      scrollToPageTitle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit OAKER check');
    } finally {
      setSubmitting(false);
    }
  }

  async function openReport(id: number) {
    setLoadingReport(true);
    setError('');
    try {
      const response = await fetch(`/api/oaker/${id}`, { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as { inspection?: InspectionDetail } | null;
      if (!response.ok) throw new Error(getApiErrorMessage(response, payload, 'Failed to load OAKER report'));
      if (payload?.inspection) setSelectedReport(payload.inspection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAKER report');
    } finally {
      setLoadingReport(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container py-6 md:py-10">
        {!active ? (
          <div className="mx-auto max-w-5xl space-y-6">
            <div ref={pageTitleRef} className="flex scroll-mt-28 flex-col gap-2">
              <p className="text-sm uppercase tracking-widest text-sky-600">Store standards</p>
              <h1 className="text-3xl font-semibold text-slate-900">OAKER Experience</h1>
              <p className="max-w-3xl text-sm text-slate-500">
                Complete full standards inspections or adaptive Express self-checks with scoring, feedback, and photo evidence.
              </p>
            </div>

            {error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

            <Card title="Choose Store" description="Select the store before starting an OAKER Experience check.">
              <label className="block text-sm font-medium text-slate-700">
                Store
                <select
                  value={storeId}
                  disabled={!canChooseStore && stores.length === 1}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-normal"
                >
                  <option value="">Choose a store</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </label>
            </Card>

            {draft ? (
              <button
                type="button"
                onClick={resumeDraft}
                className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-left shadow-card transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Saved progress</p>
                    <h2 className="mt-2 text-2xl font-semibold text-amber-950">Resume check</h2>
                    <p className="mt-1 text-sm text-amber-800">
                      {stores.find((store) => String(store.id) === draft.storeId)?.name ?? 'Saved store'} · {draft.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience'} · saved {new Date(draft.updatedAt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white">Resume</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    discardDraft();
                  }}
                  className="mt-4 rounded-xl border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Discard saved check
                </button>
              </button>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => startCheck('experience')}
                disabled={loading}
                className="flex min-h-72 flex-col rounded-2xl border border-emerald-200 bg-white p-8 text-left shadow-card transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Full inspection</p>
                <div className="mt-6 flex-1">
                  <h2 className="text-3xl font-semibold text-slate-900">Complete a full OAKER Experience</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    Run the complete store standards visit with every OAKER Experience question.
                  </p>
                </div>
                <span className="mt-8 inline-flex self-start rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">
                  Start full OAKER Experience
                </span>
              </button>

              <button
                type="button"
                onClick={() => startCheck('express')}
                disabled={loading}
                className="flex min-h-72 flex-col rounded-2xl border border-sky-200 bg-white p-8 text-left shadow-card transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Quick sense check</p>
                <div className="mt-6 flex-1">
                  <h2 className="text-3xl font-semibold text-slate-900">Complete an OAKER Express</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {expressDescription || 'Run the adaptive quick check focused on the highest-priority standards.'}
                  </p>
                </div>
                <span className="mt-8 inline-flex self-start rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white">
                  Start OAKER Express
                </span>
              </button>
            </div>
          </div>
        ) : isReportStep || (currentQuestion && currentResponse) ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <div ref={pageTitleRef} className="flex scroll-mt-28 flex-col gap-2">
              <p className="text-sm uppercase tracking-widest text-sky-600">Store standards</p>
              <h1 className="text-3xl font-semibold text-slate-900">OAKER Experience</h1>
              <p className="max-w-3xl text-sm text-slate-500">
                Complete full standards inspections or adaptive Express self-checks with scoring, feedback, and photo evidence.
              </p>
            </div>

            {error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

            <div ref={activeQuestionRef} className="flex scroll-mt-6 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600">{selectedStoreName} · {mode === 'express' ? 'Express' : 'Full Experience'}</p>
                <p className="text-sm font-semibold text-slate-900">{isReportStep ? 'Report and submit' : `Question ${currentIndex + 1} of ${questions.length}`}</p>
              </div>
              <button type="button" onClick={() => setActive(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                Exit
              </button>
            </div>

            {isReportStep ? (
              <Card className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Report</p>
                  <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">Overall report notes</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Add the overall summary before submitting the completed check.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Answered</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{completedCount}/{questions.length}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Yes</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-700">{questions.filter((question) => responses[question.id]?.answer === 'yes').length}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Actions</p>
                    <p className="mt-1 text-2xl font-semibold text-rose-700">{questions.filter((question) => responses[question.id]?.answer && responses[question.id]?.answer !== 'yes').length}</p>
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Overall report notes
                  <textarea
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal"
                    placeholder="Required improvements, clear actions, and what should be checked on follow-up."
                  />
                </label>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setCurrentIndex(Math.max(0, questions.length - 1))}>
                    Previous
                  </Button>
                  <Button type="button" onClick={submitCheck} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Check'}
                  </Button>
                </div>
              </Card>
            ) : currentQuestion && currentResponse ? (
            <Card className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{currentQuestion.section}</span>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{currentQuestion.weighting} pts</span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Standard #{currentQuestion.id}</p>
                <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-900">{currentQuestion.standard}</h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['yes', 'no', 'capex'] as OakerAnswer[]).map((answer) => (
                  <button
                    key={answer}
                    type="button"
                    onClick={() => updateResponse(currentQuestion.id, { answer })}
                    className={`min-h-14 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${currentResponse.answer === answer ? ANSWER_STYLES[answer] : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
                  >
                    {ANSWER_LABELS[answer]}
                  </button>
                ))}
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Feedback
                <textarea
                  rows={4}
                  value={currentResponse.comments}
                  onChange={(e) => updateResponse(currentQuestion.id, { comments: e.target.value })}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal"
                  placeholder="What did you see? What should happen next?"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Photos
                <input
                  key={currentQuestion.id}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(e) => handlePhotoChange(currentQuestion.id, e)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal file:mr-3 file:rounded-xl file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700"
                />
              </label>

              {currentResponse.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {currentResponse.photos.map((photo, index) => (
                    <div key={`${currentQuestion.id}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <img src={photo} alt={`Evidence ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateResponse(currentQuestion.id, { photos: currentResponse.photos.filter((_, itemIndex) => itemIndex !== index) })}
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>
                  Previous
                </Button>
                <Button type="button" onClick={() => setCurrentIndex((index) => Math.min(questions.length, index + 1))}>
                  Next
                </Button>
              </div>
            </Card>
            ) : null}

            <Card title="Check Progress" description={`${completedCount} of ${questions.length} answered.`}>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${(completedCount / questions.length) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {sectionJumpLinks.map((link) => (
                  <button
                    key={link.section}
                    type="button"
                    onClick={() => setCurrentIndex(link.index)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${currentQuestion?.section === link.section ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {link.section} · {link.done}/{link.total}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentIndex(questions.length)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isReportStep ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Report notes · Submit
                </button>
              </div>
            </Card>
          </div>
        ) : null}
      </main>

      <Dialog
        open={!!selectedReport}
        title={selectedReport ? `${selectedReport.storeName} OAKER Report` : 'OAKER Report'}
        description={selectedReport ? `${selectedReport.mode === 'express' ? 'Express Check' : 'Full OAKER Experience'} by ${selectedReport.inspectorName} on ${new Date(selectedReport.submittedAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        onClose={() => setSelectedReport(null)}
        className="max-h-[90vh] max-w-5xl overflow-y-auto"
      >
        {selectedReport ? (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{selectedReport.percentage.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">{selectedReport.score} of {selectedReport.maxScore}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rating</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${RATING_STYLES[selectedReport.rating] ?? 'bg-slate-100 text-slate-700'}`}>
                  {selectedReport.rating}
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Issues</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{failedReportResponses.length}</p>
                <p className="text-xs text-slate-500">No / Capex responses</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Photos</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{reportPhotoCount}</p>
                <p className="text-xs text-slate-500">Evidence images</p>
              </div>
            </div>

            {selectedReport.reportPath ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-sky-900">Original Layla report</p>
                    <p className="text-xs text-sky-700">Open the full PDF report with the original layout, photos, and notes.</p>
                  </div>
                  <a
                    href={selectedReport.reportPath}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    Open PDF
                  </a>
                </div>
              </div>
            ) : null}

            {selectedReport.reportText ? (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Extracted Report Notes</p>
                <div className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedReport.reportText}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Section Scores</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {reportSections.map((section) => (
                  <div key={section.section} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">{section.section}</p>
                      <p className="text-sm font-bold text-slate-900">{section.percentage.toFixed(1)}%</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(section.percentage, 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {section.score} of {section.maxScore} · {section.failed} failed · {section.capex} capex
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {selectedReport.notes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall Notes</p>
                <p className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-700">{selectedReport.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Failed / Capex Standards</p>
              {failedReportResponses.length === 0 ? (
                <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">No failed standards recorded in this check.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {failedReportResponses.map((response) => (
                    <div key={response.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">#{response.questionId}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{response.section}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ANSWER_STYLES[response.answer]}`}>
                          {ANSWER_LABELS[response.answer]}
                        </span>
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{response.weighting} pts</span>
                      </div>
                      <p className="mt-3 font-medium leading-relaxed text-slate-900">{response.standard}</p>
                      {response.comments ? <p className="mt-2 text-slate-600">{response.comments}</p> : null}
                      {response.photos.length > 0 ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {response.photos.map((photo, index) => (
                            <a key={`${response.id}-${index}`} href={photo} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                              <img src={photo} alt={`Evidence for standard ${response.questionId}`} className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">All Responses</p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-100">
                {selectedReport.responses.map((response) => (
                  <div key={response.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">#{response.questionId} · {response.section}</p>
                      <p className="mt-1 text-slate-800">{response.standard}</p>
                    </div>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${ANSWER_STYLES[response.answer]}`}>
                      {ANSWER_LABELS[response.answer]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : loadingReport ? (
          <p className="text-sm text-slate-500">Loading report...</p>
        ) : null}
      </Dialog>
    </div>
  );
}
