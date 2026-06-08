import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createOakerInspection, getOakerInspections, getOakerQuestionStats, getStores } from '@/lib/db';
import { getOakerQuestions, OAKER_EXPRESS_DESCRIPTION, OAKER_QUESTIONS, scoreOakerResponses, type OakerAnswer, type OakerMode } from '@/lib/oaker';

export const dynamic = 'force-dynamic';

function normalizeRole(role: string | undefined) {
  return ['employee', 'manager', 'director', 'super_admin'].includes(role || '') ? role! : 'employee';
}

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  const url = new URL(request.url);
  const requestedStoreId = url.searchParams.get('storeId');
  const parsedStoreId = requestedStoreId && /^\d+$/.test(requestedStoreId) ? Number(requestedStoreId) : undefined;
  const storeId = role === 'manager' ? Number(session.user.storeId) : parsedStoreId;
  const mode = url.searchParams.get('mode') === 'express' ? 'express' : 'experience';

  if (role === 'manager' && !session.user.storeId) {
    return NextResponse.json({ error: 'Store account is missing a store assignment.' }, { status: 403 });
  }

  const [stores, inspections, stats] = await Promise.all([
    getStores(),
    getOakerInspections({ role, userStoreId: session.user.storeId, storeId }),
    getOakerQuestionStats(storeId),
  ]);

  const visibleStores = stores
    .filter((store) => store.name.trim().toLowerCase() !== 'nutgrove')
    .sort((a, b) => a.name.localeCompare(b.name));
  const questions = getOakerQuestions(mode, stats);
  const latestByStore = new Map<number, (typeof inspections)[number]>();
  for (const inspection of inspections) {
    if (!latestByStore.has(inspection.storeId)) latestByStore.set(inspection.storeId, inspection);
  }

  return NextResponse.json({
    stores: role === 'manager'
      ? visibleStores.filter((store) => store.id === Number(session.user.storeId))
      : visibleStores,
    inspections,
    latestByStore: Array.from(latestByStore.values()),
    template: {
      mode,
      questions,
      fullQuestionCount: OAKER_QUESTIONS.length,
      expressDescription: OAKER_EXPRESS_DESCRIPTION,
    },
  });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  const body = await request.json().catch(() => ({}));
  const mode: OakerMode = body.mode === 'express' ? 'express' : 'experience';
  const requestedStoreId = Number(body.storeId);
  const storeId = role === 'manager' ? Number(session.user.storeId) : requestedStoreId;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const incomingResponses = Array.isArray(body.responses) ? body.responses : [];

  if (!storeId) {
    return NextResponse.json({ error: 'Store is required.' }, { status: 400 });
  }
  if (incomingResponses.length === 0) {
    return NextResponse.json({ error: 'At least one response is required.' }, { status: 400 });
  }

  const questionById = new Map(OAKER_QUESTIONS.map((question) => [question.id, question]));
  const responses = incomingResponses.map((item: any) => {
    const questionId = Number(item.questionId);
    const question = questionById.get(questionId);
    const answer = item.answer as OakerAnswer;
    if (!question || !['yes', 'no', 'capex'].includes(answer)) return null;
    const photos = Array.isArray(item.photos)
      ? item.photos.filter((photo: unknown): photo is string => typeof photo === 'string' && photo.startsWith('data:'))
      : [];
    return {
      questionId,
      section: question.section,
      standard: question.standard,
      weighting: question.weighting,
      answer,
      comments: typeof item.comments === 'string' ? item.comments.trim() : '',
      photos,
    };
  });

  if (responses.some((item: (typeof responses)[number]) => item === null)) {
    return NextResponse.json({ error: 'One or more responses are invalid.' }, { status: 400 });
  }

  const cleanResponses = responses as NonNullable<(typeof responses)[number]>[];
  const failedWithoutPhoto = cleanResponses.find((response) => response.answer !== 'yes' && response.photos.length === 0);
  if (failedWithoutPhoto) {
    return NextResponse.json({ error: `Please add at least one photo for question ${failedWithoutPhoto.questionId}.` }, { status: 400 });
  }

  const score = scoreOakerResponses(cleanResponses);
  const inspection = await createOakerInspection({
    storeId,
    userId: Number(session.user.id),
    mode,
    notes: notes || null,
    ...score,
    responses: cleanResponses,
  });

  return NextResponse.json({ inspection }, { status: 201 });
}
