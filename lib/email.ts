import nodemailer from 'nodemailer';
import type { RequestRecord } from '@/lib/db';

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

function formatCurrencyEur(amount: number) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function buildRequestEmailHtml(request: RequestRecord): string {
  const appUrl = process.env.NEXTAUTH_URL ?? 'https://opex.oakberry.ie';
  const approvalUrl = `${appUrl}/approval`;
  const submittedAt = new Date(request.createdAt).toLocaleString('en-IE', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New OPEX Request</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#6d2f8e;padding:28px 36px;">
              <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">OAKBERRY Ireland</p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">New OPEX Request</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 24px;color:#475569;font-size:15px;">
                A new expense request has been submitted and is awaiting your approval.
              </p>

              <!-- Amount highlight -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f0ff;border:1px solid #d8b4fe;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0;color:#6d2f8e;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Amount Requested</p>
                    <p style="margin:6px 0 0;color:#3a1750;font-size:32px;font-weight:700;">${formatCurrencyEur(request.amount)}</p>
                  </td>
                </tr>
              </table>

              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                ${[
                  ['Submitted by',  request.submitterName || request.requesterName],
                  ['Role',          request.submitterJobRole || request.requesterRole || '—'],
                  ['Store',         request.storeName],
                  ['Category',      request.category],
                  ['Description',   request.description],
                  ['Submitted at',  submittedAt],
                  ['Reference #',   `REQ-${String(request.id).padStart(4, '0')}`],
                ].map(([label, value], i) => `
                  <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
                    <td style="padding:11px 16px;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap;width:140px;">${label}</td>
                    <td style="padding:11px 16px;color:#1e293b;font-size:13px;">${value}</td>
                  </tr>
                `).join('')}
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${approvalUrl}"
                       style="display:inline-block;background:#6d2f8e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 32px;border-radius:8px;">
                      Review &amp; Approve →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                OAKBERRY Ireland OPEX Portal · This is an automated notification
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendNewRequestEmail(
  request: RequestRecord,
  recipients: { name: string; email: string }[],
): Promise<void> {
  if (recipients.length === 0) return;

  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? `OAKBERRY OPEX <${process.env.SMTP_USER}>`;
  const subject = `New OPEX Request — ${request.category} · ${formatCurrencyEur(request.amount)} · ${request.storeName}`;
  const html = buildRequestEmailHtml(request);

  await transport.sendMail({
    from,
    to: recipients.map((r) => `${r.name} <${r.email}>`).join(', '),
    subject,
    html,
  });
}
