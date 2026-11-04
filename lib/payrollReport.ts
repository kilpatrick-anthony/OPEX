import PDFDocument from 'pdfkit';
import type { RequestRecord } from '@/lib/db';

export function getPreviousWeekRange(now = new Date()) {
  const end = new Date(now);
  const day = end.getUTCDay();
  end.setUTCDate(end.getUTCDate() - (day === 0 ? 6 : day - 1));
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

export function formatReportDate(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function parseReportDate(value: unknown): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(value)) {
    const normalized = `${value.replace(' ', 'T')}Z`.replace(/ZZ$/, 'Z');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(String(value));
  return parsed;
}

export async function createPayrollReportPdf(
  requests: RequestRecord[],
  start: Date,
  end: Date,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const dateRange = `${formatReportDate(start)} - ${formatReportDate(new Date(end.getTime() - 1))}`;
    doc.fontSize(20).fillColor('#0f172a').text('OPEX Report', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor('#64748b').text(`Approved expenses: ${dateRange}`);
    doc.moveDown();

    const reimbursable = requests.filter((request) => request.reimbursable !== false);
    const excluded = requests.filter((request) => request.reimbursable === false);
    const total = reimbursable.reduce((sum, request) => sum + Number(request.amount), 0);
    doc.fontSize(12).fillColor('#0f172a').text(`Total reimbursement: EUR ${total.toFixed(2)}`);
    doc.moveDown();

    const groups = new Map<string, { name: string; type: 'Store' | 'Field Team'; requests: RequestRecord[] }>();
    const locationNames = [...new Set(requests.map((request) => request.storeName))].sort();
    for (const name of locationNames) {
      groups.set(`store:${name}`, { name, type: 'Store', requests: requests.filter((request) => request.storeName === name) });
    }

    const users = new Map<number, string>();
    for (const request of requests) users.set(request.userId, request.requesterName);
    for (const [userId, name] of users) {
      groups.set(`user:${userId}`, {
        name,
        type: 'Field Team',
        requests: requests.filter((request) => request.userId === userId),
      });
    }

    const drawTableRow = (
      values: string[],
      options: { color?: string; strike?: boolean; bold?: boolean } = {},
    ) => {
      const widths = [70, 150, 190, 85];
      const startX = doc.x;
      const rowY = doc.y;
      doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.bold ? 10 : 9).fillColor(options.color ?? '#334155');
      for (let index = 0; index < values.length; index++) {
        const width = widths[index];
        doc.text(values[index], startX + widths.slice(0, index).reduce((sum, item) => sum + item, 0), rowY, {
          width: width - 8,
          lineBreak: true,
          strike: options.strike,
        });
      }
      doc.moveDown(0.2);
    };

    if (groups.size === 0) {
      doc.fontSize(11).fillColor('#94a3b8').text('No approved expenses in this period.');
    }

    for (const group of groups.values()) {
      if (doc.y > 680) doc.addPage();
      const reimbursableRequests = group.requests.filter((request) => request.reimbursable !== false);
      const excludedRequests = group.requests.filter((request) => request.reimbursable === false);
      const groupTotal = reimbursableRequests.reduce((sum, request) => sum + Number(request.amount), 0);

      doc.moveDown(0.4);
      doc.rect(40, doc.y, 515, 46).fill('#f8fafc');
      doc.fillColor('#64748b').fontSize(9).text(group.type.toUpperCase(), 52, doc.y - 36);
      doc.fillColor('#0f172a').fontSize(13).text(group.name, 52, doc.y - 21);
      doc.text(`EUR ${groupTotal.toFixed(2)}`, 390, doc.y - 21, { width: 150, align: 'right' });
      doc.moveDown(3);

      if (reimbursableRequests.length === 0 && excludedRequests.length === 0) continue;
      drawTableRow(['Submitted', 'Category', 'Description', 'Amount'], { bold: true, color: '#64748b' });
      for (const request of reimbursableRequests) {
        drawTableRow([
          formatReportDate(parseReportDate(request.createdAt)),
          request.category,
          request.description,
          `EUR ${Number(request.amount).toFixed(2)}`,
        ]);
      }
      for (const request of excludedRequests) {
        drawTableRow([
          formatReportDate(parseReportDate(request.createdAt)),
          request.category,
          request.description,
          `EUR ${Number(request.amount).toFixed(2)}`,
        ], { color: '#94a3b8', strike: true });
      }
      drawTableRow(['', '', 'Total for reimbursement', `EUR ${groupTotal.toFixed(2)}`], {
        bold: true,
        color: '#059669',
      });
      if (excludedRequests.length > 0) {
        doc.fontSize(8).fillColor('#94a3b8').text(
          `${excludedRequests.length} item${excludedRequests.length === 1 ? '' : 's'} excluded (paid by card or another method)`,
        );
      }
    }

    doc.end();
  });
}
