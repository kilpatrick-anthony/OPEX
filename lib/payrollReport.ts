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
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function createPayrollReportPdf(
  requests: RequestRecord[],
  start: Date,
  end: Date,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
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

    doc.fontSize(14).text('Expenses for reimbursement');
    doc.moveDown(0.5);
    for (const request of reimbursable) {
      doc.fontSize(10).fillColor('#0f172a').text(
        `${formatReportDate(new Date(request.createdAt))} | ${request.storeName} | ${request.requesterName} | ${request.category}`,
      );
      doc.fontSize(10).fillColor('#475569').text(`${request.description} - EUR ${Number(request.amount).toFixed(2)}`);
      doc.moveDown(0.5);
    }
    if (reimbursable.length === 0) {
      doc.fontSize(10).fillColor('#94a3b8').text('No reimbursable expenses in this period.');
    }

    if (excluded.length > 0) {
      doc.moveDown();
      doc.fontSize(14).fillColor('#0f172a').text('Excluded (paid by card or other method)');
      doc.moveDown(0.5);
      for (const request of excluded) {
        doc.fontSize(10).fillColor('#475569').text(
          `${formatReportDate(new Date(request.createdAt))} | ${request.storeName} | ${request.requesterName} | ${request.category} | ${request.description} - EUR ${Number(request.amount).toFixed(2)}`,
        );
      }
    }

    doc.end();
  });
}
