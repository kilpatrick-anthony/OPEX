import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getOakerInspectionById } from '@/lib/db';
import { buildOakerCheckPdf } from '@/lib/oakerEmail';

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

  const pdf = await buildOakerCheckPdf(inspection);
  const filename = `oaker-check-${inspection.id}-${inspection.storeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
