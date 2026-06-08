'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OakerNavbar } from '@/components/OakerNavbar';
import { formatCurrency, getApiErrorMessage, readJsonSafely } from '@/lib/utils';
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

type ResponseState = {
  answer: OakerAnswer | '';
  comments: string;
  photos: string[];
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
  'OAKER Expert': 'bg-emerald-50 text-emerald-700',
  'Classic OAKER': 'bg-sky-50 text-sky-700',
  'Critical / Rising OAKER': 'bg-rose-50 text-rose-700',
};

function formatScore(inspection: Inspection) {
  return `${inspection.score} of ${inspection.maxScore} · ${inspection.percentage.toFixed(1)}%`;
}

function readFiles(files: File[]) {
  return Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  })));
}

export default function OakerPage() {
  const router = useRouter();
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentQuestion = questions[currentIndex];
  const currentResponse = currentQuestion ? responses[currentQuestion.id] ?? { answer: '', comments: '', photos: [] } : null;
  const completedCount = questions.filter((question) => responses[question.id]?.answer).length;
  const failedWithoutPhotoCount = questions.filter((question) => {
    const response = responses[question.id];
    return response?.answer && response.answer !== 'yes' && response.photos.length === 0;
  }).length;

  const selectedStoreName = stores.find((store) => String(store.id) === storeId)?.name ?? '';
  const canChooseStore = user?.role === 'director' || user?.role === 'super_admin';

  const sectionSummary = useMemo(() => {
    return questions.reduce<Record<string, { total: number; done: number }>>((acc, question) => {
      if (!acc[question.section]) acc[question.section] = { total: 0, done: 0 };
      acc[question.section].total += 1;
      if (responses[question.id]?.answer) acc[question.section].done += 1;
      return acc;
    }, {});
  }, [questions, responses]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

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
      setStores(Array.isArray(payload?.stores) ? payload.stores : []);
      setInspections(Array.isArray(payload?.inspections) ? payload.inspections : []);
      setLatestByStore(Array.isArray(payload?.latestByStore) ? payload.latestByStore : []);
      setQuestions(Array.isArray(payload?.template?.questions) ? payload.template.questions : []);
      setExpressDescription(payload?.template?.expressDescription ?? '');
      if (!nextStoreId && payload?.stores?.length === 1) setStoreId(String(payload.stores[0].id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAKER data');
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
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('Each photo must be under 5 MB.');
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

  function startCheck() {
    if (!storeId) {
      setError('Please choose a store first.');
      return;
    }
    setError('');
    setSuccess('');
    setResponses({});
    setNotes('');
    setCurrentIndex(0);
    setActive(true);
  }

  async function submitCheck() {
    setError('');
    setSuccess('');
    if (completedCount !== questions.length) {
      setError('Please answer every question before submitting.');
      return;
    }
    if (failedWithoutPhotoCount > 0) {
      setError('Please add at least one photo for every No or Capex answer.');
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
      await loadOaker(mode, storeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit OAKER check');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <OakerNavbar />
      <main className="container py-6 md:py-10">
        <div className="mb-6 flex flex-col gap-2 md:mb-8">
          <p className="text-sm uppercase tracking-widest text-sky-600">Store standards</p>
          <h1 className="text-3xl font-semibold text-slate-900">OAKER Experience</h1>
          <p className="max-w-3xl text-sm text-slate-500">
            Complete full standards inspections or adaptive Express self-checks with scoring, feedback, and photo evidence.
          </p>
        </div>

        {error ? <p className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

        {!active ? (
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <Card title="Start a Check" description="OAKER Express is built for quick mobile sense checks.">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('express')}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${mode === 'express' ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                >
                  <p className="text-sm font-semibold text-slate-900">OAKER Express</p>
                  <p className="mt-1 text-xs text-slate-500">Adaptive quick check.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('experience')}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${mode === 'experience' ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                >
                  <p className="text-sm font-semibold text-slate-900">Full Experience</p>
                  <p className="mt-1 text-xs text-slate-500">Complete 63-question inspection.</p>
                </button>
              </div>

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

              {mode === 'express' ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  {expressDescription}
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p><span className="font-medium text-slate-800">Questions:</span> {loading ? 'Loading...' : questions.length}</p>
                <p><span className="font-medium text-slate-800">Photo rule:</span> No and Capex answers require at least one photo.</p>
              </div>

              <Button type="button" onClick={startCheck} disabled={loading || !questions.length}>
                Start {mode === 'express' ? 'Express Check' : 'Full OAKER Experience'}
              </Button>
            </Card>

            <div className="space-y-6">
              <Card title="Latest Store Scores" description="Most recent OAKER score by store.">
                {latestByStore.length === 0 ? (
                  <p className="text-sm text-slate-500">No OAKER checks have been submitted yet.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {latestByStore.slice(0, 8).map((inspection) => (
                      <div key={inspection.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{inspection.storeName}</p>
                            <p className="text-xs text-slate-500">{inspection.mode === 'express' ? 'Express' : 'Full Experience'} · {new Date(inspection.submittedAt).toLocaleDateString('en-IE')}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RATING_STYLES[inspection.rating] ?? 'bg-slate-100 text-slate-700'}`}>
                            {inspection.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{inspection.rating}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Recent Checks" description="Submitted OAKER activity.">
                {inspections.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent checks yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="py-2 pr-4">Store</th>
                          <th className="py-2 pr-4">Mode</th>
                          <th className="py-2 pr-4">Score</th>
                          <th className="py-2 pr-4">Inspector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspections.slice(0, 10).map((inspection) => (
                          <tr key={inspection.id}>
                            <td className="py-3 pr-4 font-medium text-slate-900">{inspection.storeName}</td>
                            <td className="py-3 pr-4 capitalize text-slate-600">{inspection.mode}</td>
                            <td className="py-3 pr-4 text-slate-600">{formatScore(inspection)}</td>
                            <td className="py-3 pr-4 text-slate-500">{inspection.inspectorName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : currentQuestion && currentResponse ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="sticky top-[72px] z-30 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-sky-600">{selectedStoreName} · {mode === 'express' ? 'Express' : 'Full Experience'}</p>
                  <p className="text-sm font-semibold text-slate-900">Question {currentIndex + 1} of {questions.length}</p>
                </div>
                <button type="button" onClick={() => setActive(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  Exit
                </button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${(completedCount / questions.length) * 100}%` }} />
              </div>
            </div>

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
              ) : currentResponse.answer && currentResponse.answer !== 'yes' ? (
                <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                  Please add at least one photo for No or Capex answers.
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>
                  Previous
                </Button>
                {currentIndex === questions.length - 1 ? (
                  <Button type="button" onClick={submitCheck} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Check'}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}>
                    Next
                  </Button>
                )}
              </div>
            </Card>

            <Card title="Check Progress" description={`${completedCount} of ${questions.length} answered.`}>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(sectionSummary).map(([section, summary]) => (
                  <div key={section} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{section}</p>
                    <p className="text-xs text-slate-500">{summary.done} of {summary.total} complete</p>
                  </div>
                ))}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Overall report notes
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal"
                  placeholder="Required improvements, clear actions, and what should be checked on follow-up."
                />
              </label>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
