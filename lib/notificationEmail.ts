type DecisionAction = 'approved' | 'rejected' | 'queried';

function getActionLabel(action: DecisionAction) {
  if (action === 'approved') return 'Approved';
  if (action === 'rejected') return 'Rejected';
  return 'Queried';
}

export async function sendRequestDecisionEmail(data: {
  toEmail: string;
  toName: string;
  action: DecisionAction;
  requestId: number;
  storeName: string;
  category: string;
  amount: number;
  comment?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

  if (!apiKey || !from || !appUrl) {
    return;
  }

  const actionLabel = getActionLabel(data.action);
  const requestUrl = `${appUrl.replace(/\/$/, '')}/requests`;
  const subject = `OPEX Request #${data.requestId} ${actionLabel}`;
  const amount = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(data.amount);

  const note = data.comment?.trim() ? `<p><strong>Director note:</strong> ${data.comment.trim()}</p>` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>Hi ${data.toName},</p>
      <p>Your request has been <strong>${actionLabel.toLowerCase()}</strong>.</p>
      <ul>
        <li><strong>Request ID:</strong> #${data.requestId}</li>
        <li><strong>Store / Team:</strong> ${data.storeName}</li>
        <li><strong>Category:</strong> ${data.category}</li>
        <li><strong>Amount:</strong> ${amount}</li>
      </ul>
      ${note}
      <p><a href="${requestUrl}" style="display: inline-block; background: #6d2f8e; color: #fff; padding: 10px 14px; border-radius: 8px; text-decoration: none;">Open Requests</a></p>
      <p style="color: #64748b; font-size: 13px;">OAKBERRY OPEX Portal</p>
    </div>
  `;

  const text = [
    `Hi ${data.toName},`,
    `Your request has been ${actionLabel.toLowerCase()}.`,
    `Request ID: #${data.requestId}`,
    `Store / Team: ${data.storeName}`,
    `Category: ${data.category}`,
    `Amount: ${amount}`,
    data.comment?.trim() ? `Director note: ${data.comment.trim()}` : '',
    `Open Requests: ${requestUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [data.toEmail],
      subject,
      html,
      text,
    }),
  });
}

export async function sendReceiptToAccountant(data: {
  requestId: number;
  storeName: string;
  category: string;
  amount: number;
  requesterName: string;
  approvedAt: string;
  receiptDataUrl?: string;
  receiptDataUrls?: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const accountantEmail = process.env.ACCOUNTANT_EMAIL;

  if (!apiKey || !from || !accountantEmail) return;

  const accountantRecipients = accountantEmail.split(',').map((e) => e.trim()).filter(Boolean);

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  const receiptDataUrls = data.receiptDataUrls?.length ? data.receiptDataUrls : data.receiptDataUrl ? [data.receiptDataUrl] : [];
  const attachments = receiptDataUrls
    .map((receiptDataUrl, index) => {
      const match = receiptDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!match) return null;
      const [, mime, base64Content] = match;
      const ext = extMap[mime] ?? 'bin';
      const suffix = receiptDataUrls.length > 1 ? `-${index + 1}` : '';
      return {
        filename: `receipt-${data.requestId}${suffix}.${ext}`,
        content: base64Content,
      };
    })
    .filter((item): item is { filename: string; content: string } => Boolean(item));

  if (attachments.length === 0) return;

  const amount = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(data.amount);

  const approvedDate = new Date(data.approvedAt).toLocaleString('en-IE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const subject = `OPEX Receipt – Request #${data.requestId} | ${data.storeName} | ${amount}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hi,</p>
      <p>An OPEX expense has been approved. The receipt${attachments.length === 1 ? ' is' : 's are'} attached to this email.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 480px;">
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Request ID</td><td style="padding: 6px 0; font-weight: 600;">#${data.requestId}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Store</td><td style="padding: 6px 0; font-weight: 600;">${data.storeName}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Category</td><td style="padding: 6px 0; font-weight: 600;">${data.category}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Amount</td><td style="padding: 6px 0; font-weight: 600;">${amount}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Submitted by</td><td style="padding: 6px 0; font-weight: 600;">${data.requesterName}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #64748b; font-size: 13px;">Approved on</td><td style="padding: 6px 0; font-weight: 600;">${approvedDate}</td></tr>
      </table>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">OAKBERRY OPEX Portal</p>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: accountantRecipients,
      subject,
      html,
      attachments,
    }),
  });
}
