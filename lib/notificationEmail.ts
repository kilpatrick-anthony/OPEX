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
