import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { queryApprovedRequestsBetween } from '@/lib/db';
import { createPayrollReportPdf, formatReportDate, getPreviousWeekRange } from '@/lib/payrollReport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get('authorization') !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const { start, end } = getPreviousWeekRange();
    const requests = await queryApprovedRequestsBetween(start, end);
    const pdf = await createPayrollReportPdf(requests, start, end);

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set.');
    }

    const recipients = (process.env.OPEX_REPORT_RECIPIENTS ?? '')
      .split(',')
      .map((recipient) => recipient.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      throw new Error('OPEX_REPORT_RECIPIENTS must contain at least one email address.');
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    const dateRange = `${formatReportDate(start)} - ${formatReportDate(new Date(end.getTime() - 1))}`;
    const filename = `OPEX Report - ${dateRange.replaceAll(' ', '-')}.pdf`;

    await transport.sendMail({
      from: process.env.SMTP_FROM ?? `OAKBERRY OPEX <${user}>`,
      to: recipients,
      subject: `OPEX Report - ${dateRange}`,
      text: `The approved OPEX report for ${dateRange} is attached.`,
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    });

    return NextResponse.json({
      ok: true,
      sentTo: recipients,
      requestCount: requests.length,
      range: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error) {
    console.error('Weekly payroll report error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send weekly payroll report.',
    }, { status: 500 });
  }
}
