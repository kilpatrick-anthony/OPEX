import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { deleteOakerInspection, getOakerInspectionById, updateOakerInspection } from '@/lib/db';
import { OAKER_ANSWERS, type OakerAnswer } from '@/lib/oaker';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const inspectionId = Number(params.id);
  if (!inspectionId) {
    return NextResponse.json({ error: 'Invalid inspection ID.' }, { status: 400 });
  }

  const inspection = await getOakerInspectionById(inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  return NextResponse.json({ inspection });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin' && session.user.role !== 'director') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inspectionId = Number(params.id);
  if (!inspectionId) {
    return NextResponse.json({ error: 'Invalid inspection ID.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const editReason = typeof body.editReason === 'string' ? body.editReason.trim() : '';
  const incomingResponses = Array.isArray(body.responses) ? body.responses : [];

  if (!editReason) {
    return NextResponse.json({ error: 'An edit reason is required.' }, { status: 400 });
  }
  if (incomingResponses.length === 0) {
    return NextResponse.json({ error: 'At least one response is required.' }, { status: 400 });
  }

  const responses = incomingResponses.map((item: any) => {
    const id = Number(item.id);
    const answer = item.answer as OakerAnswer;
    if (!id || !OAKER_ANSWERS.includes(answer)) return null;
    return {
      id,
      answer,
      comments: typeof item.comments === 'string' ? item.comments : '',
    };
  });

  if (responses.some((item: (typeof responses)[number]) => item === null)) {
    return NextResponse.json({ error: 'One or more responses are invalid.' }, { status: 400 });
  }

  try {
    const inspection = await updateOakerInspection({
      inspectionId,
      notes: typeof body.notes === 'string' ? body.notes : '',
      editReason,
      responses: responses as Array<{ id: number; answer: OakerAnswer; comments: string }>,
    });
    if (!inspection) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    return NextResponse.json({ inspection });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update check.' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inspectionId = Number(params.id);
  if (!inspectionId) {
    return NextResponse.json({ error: 'Invalid inspection ID.' }, { status: 400 });
  }

  const inspection = await getOakerInspectionById(inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  await deleteOakerInspection(inspectionId);
  return NextResponse.json({ ok: true });
}
