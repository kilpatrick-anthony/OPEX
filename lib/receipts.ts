export function parseReceiptList(receipt?: string | null): string[] {
  if (!receipt) return [];
  const trimmed = receipt.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('data:')) return [trimmed];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.startsWith('data:'));
    }
  } catch {
    return [];
  }

  return [];
}

export function serializeReceiptList(receipts: string[]): string | null {
  const cleanReceipts = receipts.filter((item) => item.startsWith('data:'));
  if (cleanReceipts.length === 0) return null;
  return JSON.stringify(cleanReceipts);
}
