import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { createOakerInspection, getOakerEmailRecipients, getOakerInspections, getOakerQuestionStats, getStores } from '@/lib/db';
import { sendOakerCheckCompletedEmail } from '@/lib/oakerEmail';
import { getOakerQuestions, OAKER_EXPRESS_DESCRIPTION, OAKER_QUESTIONS, scoreOakerResponses, type OakerAnswer, type OakerMode } from '@/lib/oaker';

export const dynamic = 'force-dynamic';

function normalizeRole(role: string | undefined) {
  return ['employee', 'manager', 'director', 'super_admin'].includes(role || '') ? role! : 'employee';
}

const CURRENT_OAKER_STORES = new Set([
  'arnotts',
  'blackrock',
  'cork',
  'dundalk',
  'dun laoghaire',
  'hansfield',
  'kildare village',
  'maynooth',
  'nutgrove',
  'south anne street',
  'swords pavilions',
]);

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const role = normalizeRole(session.user.role);
  const url = new URL(request.url);
  const requestedStoreId = url.searchParams.get('storeId');
  const parsedStoreId = requestedStoreId && /^\d+$/.test(requestedStoreId) ? Number(requestedStoreId) : undefined;
  const storeId = parsedStoreId;
  const mode = url.searchParams.get('mode') === 'express' ? 'express' : 'experience';
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 50;

  const [stores, inspections, stats] = await Promise.all([
    getStores(),
    getOakerInspections({ role: 'employee', storeId }, limit),
    getOakerQuestionStats(storeId),
  ]);

  const visibleStores = stores
    .filter((store) => CURRENT_OAKER_STORES.has(store.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const questions = getOakerQuestions(mode, stats);
  const latestByStore = new Map<number, (typeof inspections)[number]>();
  for (const inspection of inspections) {
    if (!latestByStore.has(inspection.storeId)) latestByStore.set(inspection.storeId, inspection);
  }

  return NextResponse.json({
    stores: visibleStores,
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

  const body = await request.json().catch(() => ({}));
  const mode: OakerMode = body.mode === 'express' ? 'express' : 'experience';
  const requestedStoreId = Number(body.storeId);
  const storeId = requestedStoreId;
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
  const score = scoreOakerResponses(cleanResponses);
  const inspection = await createOakerInspection({
    storeId,
    userId: Number(session.user.id),
    mode,
    notes: notes || null,
    ...score,
    responses: cleanResponses,
  });

  let emailStatus: { sent: boolean; provider?: string; recipientCount: number; reason?: string } = {
    sent: false,
    recipientCount: 0,
    reason: 'not_attempted',
  };

  if (inspection) {
    try {
      const recipients = await getOakerEmailRecipients();
      emailStatus = { sent: false, recipientCount: recipients.length, reason: 'attempting' };
      emailStatus = await sendOakerCheckCompletedEmail(inspection, recipients);
      console.info('OAKER completion email status:', emailStatus);
    } catch (err) {
      console.error('Failed to send OAKER check completion email:', err);
      const message = err instanceof Error ? err.message : '';
      emailStatus = {
        sent: false,
        recipientCount: emailStatus.recipientCount,
        reason: message.includes('SMTP_HOST') ? 'email_config_missing' : message.includes('Resend') ? 'email_provider_error' : 'send_failed',
      };
    }
  }

  return NextResponse.json({ inspection, emailStatus }, { status: 201 });
}
