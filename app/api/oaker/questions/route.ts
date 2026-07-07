import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { canUserManageOakerQuestions, createOakerQuestion, getOakerQuestionBank, updateOakerQuestion } from '@/lib/db';
import { OAKER_SECTIONS, type OakerQuestion } from '@/lib/oaker';

export const dynamic = 'force-dynamic';

const SECTION_SET = new Set<string>(OAKER_SECTIONS);

function parseQuestionPayload(body: any): { section: OakerQuestion['section']; standard: string; weighting: number; active: boolean; expressPinned: boolean } | { error: string } {
  const section = typeof body.section === 'string' ? body.section : '';
  const standard = typeof body.standard === 'string' ? body.standard.trim() : '';
  const weighting = Number(body.weighting);
  const active = typeof body.active === 'boolean' ? body.active : true;
  const expressPinned = typeof body.expressPinned === 'boolean' ? body.expressPinned : false;

  if (!SECTION_SET.has(section)) return { error: 'Choose a valid section.' };
  if (!standard) return { error: 'Question text is required.' };
  if (!Number.isFinite(weighting) || weighting < 1 || weighting > 25) return { error: 'Weighting must be between 1 and 25.' };

  return { section: section as OakerQuestion['section'], standard, weighting, active, expressPinned };
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const [questions, canManage] = await Promise.all([
    getOakerQuestionBank({ includeInactive: true }),
    canUserManageOakerQuestions(Number(session.user.id), session.user.role),
  ]);
  return NextResponse.json({ questions, canManage });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (!(await canUserManageOakerQuestions(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = parseQuestionPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const question = await createOakerQuestion(parsed);
  return NextResponse.json({ question }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (!(await canUserManageOakerQuestions(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const questionId = Number(body.id);
  if (!questionId) {
    return NextResponse.json({ error: 'Question ID is required.' }, { status: 400 });
  }

  const parsed = parseQuestionPayload(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const question = await updateOakerQuestion(questionId, parsed);
  if (!question) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }

  return NextResponse.json({ question });
}
