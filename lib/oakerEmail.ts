import nodemailer from 'nodemailer';
import type { OakerAnswer, OakerMode } from '@/lib/oaker';

export type OakerEmailInspection = {
  id: number;
  storeName: string;
  inspectorName: string;
  mode: OakerMode;
  score: number;
  maxScore: number;
  percentage: number;
  rating: string;
  notes: string | null;
  submittedAt: string;
  responses: Array<{
    questionId: number;
    section: string;
    standard: string;
    weighting: number;
    answer: OakerAnswer;
    comments: string | null;
  }>;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set to send email.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function pdfString(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function wrapText(text: string, maxLength = 92) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function buildReportLines(inspection: OakerEmailInspection) {
  const submittedAt = new Date(inspection.submittedAt).toLocaleString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    'OAKER Experience Check Report',
    '',
    `Store: ${inspection.storeName}`,
    `Inspector: ${inspection.inspectorName}`,
    `Check type: ${inspection.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience'}`,
    `Submitted: ${submittedAt}`,
    `Score: ${inspection.percentage.toFixed(1)}% (${inspection.score} of ${inspection.maxScore})`,
    `Rating: ${inspection.rating}`,
    '',
  ];

  if (inspection.notes?.trim()) {
    lines.push('Overall notes:');
    lines.push(...wrapText(inspection.notes.trim(), 92));
    lines.push('');
  }

  const grouped = inspection.responses.reduce<Record<string, typeof inspection.responses>>((acc, response) => {
    if (!acc[response.section]) acc[response.section] = [];
    acc[response.section].push(response);
    return acc;
  }, {});

  for (const [section, responses] of Object.entries(grouped)) {
    lines.push(section);
    lines.push('-'.repeat(Math.min(section.length, 90)));
    for (const response of responses) {
      const answer = response.answer === 'yes' ? 'Yes' : response.answer === 'no' ? 'No' : 'Capex';
      lines.push(`#${response.questionId} [${answer}] ${response.weighting} pts`);
      lines.push(...wrapText(response.standard, 92));
      if (response.comments?.trim()) {
        lines.push(...wrapText(`Comments: ${response.comments.trim()}`, 92));
      }
      lines.push('');
    }
  }

  return lines;
}

function buildPdf(lines: string[]) {
  const pageLineLimit = 48;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageLineLimit) {
    pages.push(lines.slice(index, index + pageLineLimit));
  }

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageRefs = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectId} 0 R >>`);

    const commands: string[] = [];
    let y = 750;
    pageLines.forEach((line, lineIndex) => {
      const isTitle = pageIndex === 0 && lineIndex === 0;
      const font = isTitle ? 'F2' : 'F1';
      const size = isTitle ? 16 : 10;
      commands.push(`BT /${font} ${size} Tf 50 ${y} Td (${pdfString(line)}) Tj ET`);
      y -= isTitle ? 24 : 14;
    });
    const stream = commands.join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  });

  const parts = ['%PDF-1.4\n'];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(parts.join(''), 'utf8'));
    parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(parts.join(''), 'utf8');
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push('0000000000 65535 f \n');
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  });
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(parts.join(''), 'utf8');
}

export function buildOakerCheckPdf(inspection: OakerEmailInspection) {
  return buildPdf(buildReportLines(inspection));
}

export async function sendOakerCheckCompletedEmail(
  inspection: OakerEmailInspection,
  recipients: { name: string; email: string }[],
) {
  if (recipients.length === 0) return;

  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? `OAKBERRY OPEX <${process.env.SMTP_USER}>`;
  const subject = `OAKER Experience Check Completed - ${inspection.storeName} - ${inspection.percentage.toFixed(1)}%`;
  const appUrl = process.env.NEXTAUTH_URL ?? 'https://opex.oakberry.ie';
  const modeLabel = inspection.mode === 'express' ? 'OAKER Express' : 'Full OAKER Experience';
  const submittedAt = new Date(inspection.submittedAt).toLocaleString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p style="margin:0 0 12px;font-size:15px;">A new OAKER Experience check has been completed.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Store</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.storeName)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Check type</td><td style="padding: 6px 0; font-weight: 600;">${modeLabel}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Inspector</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.inspectorName)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Score</td><td style="padding: 6px 0; font-weight: 600;">${inspection.percentage.toFixed(1)}% (${inspection.score} of ${inspection.maxScore})</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Rating</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inspection.rating)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Submitted</td><td style="padding: 6px 0; font-weight: 600;">${submittedAt}</td></tr>
      </table>
      <p style="margin-top:18px;">The PDF report is attached.</p>
      <p><a href="${appUrl.replace(/\/$/, '')}/oaker" style="display:inline-block;background:#6d2f8e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">Open OAKER Dashboard</a></p>
      <p style="color:#64748b;font-size:13px;">OAKBERRY Ireland OPEX Portal</p>
    </div>
  `;

  const pdf = buildOakerCheckPdf(inspection);

  await transport.sendMail({
    from,
    to: recipients.map((recipient) => `${recipient.name} <${recipient.email}>`).join(', '),
    subject,
    html,
    attachments: [
      {
        filename: `oaker-check-${inspection.id}-${inspection.storeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  });
}
